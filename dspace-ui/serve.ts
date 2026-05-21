import { spawn } from "child_process";
import * as net from "net";
import * as http from "http";
import * as path from "path";

import { AppConfig } from "../src/config/app-config.interface";
import { buildAppConfig } from "../src/config/config.server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ejs = require("ejs") as typeof import("ejs");

const appConfig: AppConfig = buildAppConfig();

const bindHost = process.env.DSPACE_UI_BINDHOST ?? "0.0.0.0";
const INNER_PORT = 4001;

// ng serve escuta apenas na loopback; o wrapper expõe :4000 para o nginx
spawn(
    `ng serve --host 127.0.0.1 --port ${INNER_PORT} --allowed-hosts all ${process.argv.slice(2).join(" ")} --configuration production`,
    { stdio: "inherit", shell: true },
);

const robotsTemplate = path.resolve(__dirname, "../src/robots.txt.ejs");
const origin: string = (appConfig as any).ui?.baseUrl ?? "https://localhost";

const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
        ejs.renderFile(
            robotsTemplate,
            { origin },
            (err: Error | null, content: string) => {
                if (err) {
                    res.writeHead(500);
                    res.end(String(err));
                    return;
                }
                res.writeHead(200, {
                    "Content-Type": "text/plain; charset=utf-8",
                });
                res.end(content);
            },
        );
        return;
    }

    const proxyReq = http.request(
        {
            hostname: "127.0.0.1",
            port: INNER_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers,
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        },
    );
    proxyReq.on("error", () => {
        res.writeHead(502);
        res.end();
    });
    req.pipe(proxyReq, { end: true });
});

// WebSocket proxy (ng-cli-ws live reload)
server.on("upgrade", (req, socket, head) => {
    const conn = net.createConnection(INNER_PORT, "127.0.0.1", () => {
        const headers = Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\r\n");
        conn.write(
            `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`,
        );
        if (head?.length) conn.write(head);
        socket.pipe(conn);
        conn.pipe(socket);
    });
    conn.on("error", () => socket.destroy());
    socket.on("error", () => conn.destroy());
});

server.listen(4000, bindHost, () => {
    console.log(`[serve] ${bindHost}:4000 → ng serve :${INNER_PORT}`);
});
