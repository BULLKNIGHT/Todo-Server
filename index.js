const express = require('express')
const mongoose = require('mongoose')
const cors = require("cors")
const bcrypt = require('bcrypt')
const session = require('express-session')

const session_secret = "newton";

// Parse JSON bodies (as sent by API clients)
const app = express()
app.use(express.json()); // add body key to req
app.use(cors({
    credentials: true,
    origin: "http://localhost:8080" // if there multiple frontend url give them in commma separated
}));
app.use(session({ 
    secret: session_secret,
    cookie: { maxAge: 1*60*60*1000 }
  })); // add session key to req

// connect
const mongoURL = "mongodb+srv://malayhalder:mo9903223306@cluster0.i5oku.mongodb.net/TodoApp?retryWrites=true&w=majority"
const db = mongoose.createConnection(mongoURL, {useNewUrlParser: true, useUnifiedTopology: true})

// Schema
const userSchema = new mongoose.Schema({
    userName: String,
    password: String
})

const todoSchema = new mongoose.Schema({
    task: String,
    done: Boolean,
    creationTime: Date,
    userId: mongoose.Schema.Types.ObjectId
})

// models
const userModel = db.model('user', userSchema)
const todoModel = db.model('todo', todoSchema)

// API's
const isNullOrUndefined = (val) => (val === null || val === undefined);
const SALT = 5;

app.post('/signup', async (req, res) => {
    const {userName, password} = req.body;
    const existingUser = await userModel.findOne({ userName: userName });
    if(isNullOrUndefined(existingUser)) {
        const hashPwd = bcrypt.hashSync(password, SALT)
        const newUser = new userModel({ userName: userName, password: hashPwd })
        await newUser.save();
        req.session.userId = newUser._id;
        res.status(201).send({ success: 'Signed up'})
    } else {
        res.status(400).send({ err: `UserName ${userName} already exists. Please check`})
    }
})

app.post('/login', async (req, res) => {
    const {userName, password} = req.body;
    const existingUser = await userModel.findOne({ userName });
    if(isNullOrUndefined(existingUser)) {
        res.status(401).send({ err: 'userName does not exist'})
    } else {
        const hashPwd = existingUser.password;
        if(bcrypt.compareSync(password, hashPwd)) {
            req.session.userId = existingUser._id;
            res.status(200).send({ success: 'Logged in'})
        } else res.status(401).send({ err: 'password is incorrect'})    
    }
})

const AuthMiddleware = async (req, res, next) => {
    const userId = req.session.userId;

    if(isNullOrUndefined(req.session) || isNullOrUndefined(req.session.userId))
        res.status(401).send({ err: 'Not logged in'})
    else {
        next();
    }        
    // if(isNullOrUndefined(userName) || isNullOrUndefined(password))
    //     res.status(401).send({ err: 'userName/Password incorrect'})
    // else {
    //     const existingUser = await userModel.findOne({ userName })
    //     if(isNullOrUndefined(existingUser)) {
    //         res.status(401).send({ err: 'userName does not exist'})
    //     } else {
    //         const hashPwd = existingUser.password;
    //         if(bcrypt.compareSync(password, hashPwd)) {
    //             req.user = existingUser;
    //             next();
    //         } else {
    //             res.status(401).send({ err: 'password is incorrect'})
    //         } 
    //     }
    // }    
}

app.get('/todo', AuthMiddleware, async (req, res) => {
    const allTodos = await todoModel.find({ userId: req.session.userId });
    // console.log(allTodos);
    res.send(allTodos);
})

app.post('/todo', AuthMiddleware, async (req, res) => {
    const todo = req.body;
    todo.creationTime = new Date();
    todo.done = false;
    todo.userId = req.session.userId;
    const newTodo = new todoModel(todo);
    await newTodo.save();
    res.status(201).send(newTodo);
})

app.put('/todo/:todoid', AuthMiddleware, async (req, res) => {
    const { task } = req.body;
    const todoId = req.params.todoid;

    try {
        const todo = todoModel.findOne({ _id: todoId, userId: req.session.userId });
        if(isNullOrUndefined(todo)) {
            res.sendStatus(404);
        } else {
            todo.task = task;
            await todo.save();
            res.send(todo);
        } 
    } catch(e) {
        res.sendStatus(404);
    }
})

app.delete('/todo/:todoid', AuthMiddleware, async (req, res) => {
    const todoId = req.params.todoid;

    try {
        todoModel.deleteOne({ _id: todoId, userId: req.session.userId });
        res.sendStatus(200);
    } catch(e) {
        res.sendStatus(404);
    }
})

app.get('/logout', (req, res) => {
    if(!isNullOrUndefined(req.session)) {
        // destroy the session
        req.session.destroy(() => {
            res.sendStatus(200);
        })
    } else {
        res.sendStatus(200);
    }
})

app.get('/userinfo', AuthMiddleware, async (req, res) => {
    const user = await userModel.findById(req.session.userId)
    res.send({ userName: user.userName })
})

app.listen(process.env.PORT);
