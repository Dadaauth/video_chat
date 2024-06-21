import express from 'express';
//import https from 'https';
import http from "http";
import { dirname } from 'node:path';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import * as fs from 'fs';

const PORT = process.env.PORT || 3000;

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const privateKey = fs.readFileSync(path.join(__dirname, 'key.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'cert.pem'), 'utf8');
const credentials = {key: privateKey, cert: certificate};

const server = http.createServer(app);
const io = new SocketIOServer(server);




app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middlewares
app.use(express.static(path.join(__dirname, "public")));


app.get("/", (req, res) => {
    res.render("index");
});

let users = [];

io.on("connection", async (socket) => {
    console.log("User connected: ", socket.id);
    const clientsInRoom = await io.in("private call").fetchSockets();
    const numClients = clientsInRoom.length;
    if (numClients < 2) {
        socket.join("private call");
    } else {
        socket.emit("room full", "Room is full");
    }

    io.to(socket.id).emit("your info", socket.id);

// emit to the particular socket id that there is an incomign call the socket id will then join the call room to communicate information.
    socket.on("new client", (username) => {
        let user = {username, socketId: socket.id};
        let exists = users.some(us => us.socketId === user.socketId);
        if (!exists) users.push(user);
        io.emit("clients state change", {users});
    });

    socket.on("disconnect", (reason) => {
        users = users.filter((user) => {return user.socketId !== socket.id});
        io.emit("clients state change", {users});
    });

    socket.on("calling", (data) => {
        socket.join(data.privateRoom);
        socket.to(data.receipient.id).emit("call request", data);
    });

    socket.on("join private call room", (room) => {socket.join(room)});
    socket.on("leave private call room", (room) => {socket.leave(room)});

    socket.on("call reply", (data) => {
        socket.broadcast.to(data.call.room).emit("call reply", data);
    });

    socket.on("end call", () => {
        // make sure to leave the room on both sides once the call ends
        socket.broadcast.to("private call").emit("end call");
    });

    socket.on("call offer", (data) => {
        console.log("Call offer: ", data);
        socket.broadcast.to(data.room).emit("call offer", data);
    });

    socket.on("call offer reply", (data) => {
        socket.broadcast.to(data.room).emit("call offer reply", data);
    });

    socket.on("ice candidate from peer", (data) => {
        socket.broadcast.to(data.room).emit("ice candidate from peer", data);
    });
});

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});


