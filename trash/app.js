import express from 'express';
import https from 'https';
import { dirname } from 'node:path';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import * as fs from 'fs';



const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const privateKey = fs.readFileSync(path.join(__dirname, 'key.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'cert.pem'), 'utf8');
const credentials = {key: privateKey, cert: certificate};

const server = https.createServer(credentials, app);
const io = new SocketIOServer(server);




app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// middlewares
app.use(express.static("public"));


app.get("/", (req, res) => {
    res.render("index");
});

io.on("connection", async (socket) => {
    console.log("User connected: ", socket.id);
    const clientsInRoom = await io.in("foo").fetchSockets();
    const numClients = clientsInRoom.length;
    if (numClients < 2) {
        socket.join("private call");
    } else {
        socket.emit("room full", "Room is full");
    }

    socket.on("call sending", (data) => {
        console.log("Call Sending: ", data);
        socket.broadcast.to("private call").emit("call arrival", data);
    });

    socket.on("call denied", () => {
        console.log("Call denied event on the server");''
        socket.broadcast.to("private call").emit("call denied");
    });

    socket.on("call accepted", () => {
        console.log("Call accepted event on the server");''
        socket.broadcast.to("private call").emit("call accepted");
    });

    socket.on("call offer", (data) => {
        console.log("Call offer event on the server: ", data);
        socket.broadcast.to("private call").emit("call offer", data);
    });

    socket.on("call offer reply", (data) => {
        console.log("Call offer reply event on the server: ", data);
        socket.broadcast.to("private call").emit("call offer reply", data);
    });

    socket.on("new ice candidate", (data) => {
        console.log("New ice candidate event on the server: ", data);
        socket.broadcast.to("private call").emit("new ice candidate", data);
    });
});


server.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});


