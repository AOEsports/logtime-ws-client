import express from "express";
import fs from "fs";
import path from "path";
import * as _ from "underscore";
import WebSocket from "ws";
import chokidar from "chokidar";

let DIRECTORY = null;
let LOG_FILE = null;
let LAST_LINE_READ = 0;
let WEB_SERVER = null;
let WEB_SERVER_AUTH = { user: null, pass: null };
let WS_CONNECTION = null;
let RECONNECTING = false;

function connectToWs() {
	console.log(`Connecting to the WebServer`);
	if (WS_CONNECTION) {
		console.log(`Closing previous connection`);
		WS_CONNECTION.close();
	}
	WS_CONNECTION = new WebSocket(WEB_SERVER);

	// connect to the WS server
	WS_CONNECTION.onopen = (ws) => {
		console.log(`Connected to ${WEB_SERVER}`);
		WS_CONNECTION.send(
			JSON.stringify({
				type: "init",
				id: "gameclient",
			})
		);
		WS_CONNECTION.send(JSON.stringify({ reset: true }));
	};
	WS_CONNECTION.onmessage = (message) => {
		message = JSON.parse(message.data);
		// ping
		if (message.type === "ping") {
			WS_CONNECTION.send(
				JSON.stringify({
					type: "pong",
				})
			);
			return;
		}
	};
	WS_CONNECTION.onclose = () => {
		console.log(`Disconnected from ${WEB_SERVER}`);
		if (RECONNECTING) return;
		RECONNECTING = true;
		LAST_LINE_READ = 0;
		// attempt to reconnect every second for the next minute
		let reconnectAttempts = 0;
		const reconnectInterval = setInterval(() => {
			if (WS_CONNECTION && WS_CONNECTION.readyState == 0) return;
			if (reconnectAttempts > 60) {
				clearInterval(reconnectInterval);
				RECONNECTING = false;
				return;
			}
			if (WS_CONNECTION.readyState == 1) {
				clearInterval(reconnectInterval);
				RECONNECTING = false;
				return;
			}

			reconnectAttempts++;
			console.log(`Attempt ${reconnectAttempts} to reconnect to WS`);
			WS_CONNECTION = null;
			connectToWs();
		}, 1000);
	};
	WS_CONNECTION.onerror = (error) => {
		console.error(`Error connecting to WS`, error.message);
	};
}

const app = express()
	.use(express.static("public"))
	.use(express.json())
	.post("/submit", async ({ body }, res) => {
		if (body === null) return res.status(400).send(`no data`);
		if ("websocket" in body === false)
			return res.status(400).send(`no websocket`);
		WEB_SERVER = body.websocket;
		WEB_SERVER_AUTH = {
			user: body.websocketUser,
			pass: body.websocketPass,
		};
		console.log(`WebSocket Server is running at ${WEB_SERVER}`);
		connectToWs();

		if ("workshop" in body === false)
			return res.status(400).send(`no workshop`);
		const check = body.workshop;
		const dirExists = fs.existsSync(check);

		if (!dirExists) {
			return res.status(400).send(`invalid directory`);
		}
		DIRECTORY = body.workshop;
		res.send(true);
	})
	.listen(3001);

console.log(`WebServer is running at http://localhost:3001`);
console.log(`Please head to the webpage to select the Folder to scan.`);

const getMostRecentFileName = (dir) => {
	const files = fs.readdirSync(dir);

	// @ts-ignore
	return _.max(files, (file) => {
		const fullpath = path.join(dir, file);

		// ctime = creation time is used
		// replace with mtime for modification time
		return fs.statSync(fullpath).ctime;
	});
};

let ChokidarFileWatcher = null;

setInterval(async () => {
	if (WS_CONNECTION === null) return;
	if (WS_CONNECTION.readyState !== 1) return;

	const fileCheck = getMostRecentFileName(DIRECTORY);
	if (fileCheck !== LOG_FILE) {
		console.log(`New file found: ${fileCheck}`);
		LOG_FILE = fileCheck;
		LAST_LINE_READ = 0;
		// kill the watcher
		if (ChokidarFileWatcher !== null) {
			ChokidarFileWatcher.close();
			ChokidarFileWatcher = null;
		}
		const file = path.join(DIRECTORY, LOG_FILE);

		function handleChange(path) {
			console.log(`File changed: ${path}`);
			const data = fs.readFileSync(file, "utf8");
			const lines = data.split("\n").filter((line) => line.trim() !== "");
			if (WS_CONNECTION !== null && WS_CONNECTION.readyState == 1) {
				let linesToSend = lines.slice(LAST_LINE_READ);

				if (linesToSend.length === 0) return;

				WS_CONNECTION.send(
					JSON.stringify({
						msg: "lines",
						matchLines: linesToSend,
						lineCount: linesToSend.length,
						totalLineCount: lines.length,
						fileName: LOG_FILE,
					})
				);
				LAST_LINE_READ = lines.length;
			}
		}

		// start the watcher
		ChokidarFileWatcher = chokidar.watch(path.join(DIRECTORY, LOG_FILE));
		ChokidarFileWatcher.on("change", handleChange).on("add", handleChange);
	}
}, 5000);
