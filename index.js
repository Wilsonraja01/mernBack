const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

app.use(cors({ credentials: true, origin: 'https://blog-wilson.onrender.com' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect('mongodb+srv://wilsonrajara:20042001%40We@cluster0.jklfnn1.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true, // Add these options to fix deprecation warnings
  useUnifiedTopology: true,
});

// Define a middleware to verify JWT and store user info in res.locals
const verifyToken = (req, res, next) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.locals.userInfo = info;
    next();
  });
};

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    const token = jwt.sign({ username, id: userDoc._id }, secret);
    res.cookie('token', token).json({
      id: userDoc._id,
      username,
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/profile', verifyToken, (req, res) => {
  const userInfo = res.locals.userInfo;
  res.json(userInfo);
});

app.post('/logout', (req, res) => {
  res.clearCookie('token').json('Logged out');
});

app.post('/post', verifyToken, uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;

  fs.renameSync(path, newPath);

  const { title, summary, content } = req.body;
  const author = res.locals.userInfo.id;

  const postDoc = await Post.create({
    title,
    summary,
    content,
    cover: newPath,
    author,
  });

  res.json(postDoc);
});

app.put('/post', verifyToken, uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const { id, title, summary, content } = req.body;
  const author = res.locals.userInfo.id;

  try {
    const postDoc = await Post.findById(id);
    if (!postDoc) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postDoc.author.toString() !== author.toString()) {
      return res.status(403).json({ error: 'You are not the author of this post' });
    }

    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    postDoc.cover = newPath || postDoc.cover;
    await postDoc.save();

    res.json(postDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/post', async (req, res) => {
  const posts = await Post.find()
    .populate('author', ['username'])
    .sort({ createdAt: -1 })
    .limit(20);

  res.json(posts);
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  if (!postDoc) {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json(postDoc);
});

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});