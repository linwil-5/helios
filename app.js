const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const expressValidator = require('express-validator');
const MySQLStore = require('express-mysql-session')(session);
const faker = require('faker');

// Create connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'db_movie'
});
const sessionStore = new MySQLStore({}, db)

//Check createConnection
db.connect((err) => {
  if(err) throw err;
  console.log('MySQL Connected...');
})

//const routes = require('./routes/index');

const app = express();


// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// Set Static path
app.use(express.static(path.join(__dirname, '/public')));

app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
    var namespace = param.split('.'),
    root = namespace.shift(),
    formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg : msg,
      value : value
    };
  }
}));
app.use(session({
  key: 'cookie',
  secret: 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));


app.get('/', (req, res) => {

  console.log('-------Information --------')
  console.log(req.sessionID);
  console.log(req.session.user);
  console.log('-------Information --------')
  req.session.errors = null;
  req.session.success = null;
  db.query("SELECT * FROM Products",
    function(err, rows) {
    if (err) throw err;

  if(req.session.user == undefined){
    res.render('index', {
      title: 'Not logged in',
      success: req.session.success,
      errors: req.session.errors,
      isUserValid: false,
      products: rows,
      nameShown: ''
    });
  }
  else{
    res.render('index', {
      title: 'Welcome Customer!',
      success: req.session.success,
      errors: req.session.errors,
      isUserValid: true,
      products: rows,
      nameShown: req.session.user.user_email
    });
  }
});
});

app.get('/edit-User', (req, res) => {
  res.render('main/edit-User');
});

app.get('/home',(req, res) => {
  res.redirect('/');
});
app.get('/cart',(req, res) => {
  res.render('cart');
});
app.get('/login',(req, res) => {
  res.render('login');
});
app.get('/register',(req, res) => {
  res.render('register');
});
app.get('/add-product',(req, res) => {

  db.query("SELECT * FROM Users WHERE (user_email) = ?",[req.session.user.user_email],
    function(err, rows) {
    if (err) throw err;
    if(req.session.user.user_email == undefined){
      res.redirect('/');
    }
    rows.forEach(function(result){

      if(result.isAdmin == true) {
        res.render('main/add-product');
      }else{
        res.redirect('/');
      }
    });
  });
});

app.get('/logout', (req, res) => {
  if(req.session.user != undefined){
    req.session.destroy();
  };
//  return res.status(200);
  res.redirect('/');
});

app.get('/add-tocart/:id', (req, res) => {
  var name_product = req.params.id;
  console.log(name_product);
});




  // post to mysql databade
app.post('/register', (req, res) => {

  // Check needs to be updated
  req.checkBody('user_email_', 'User Email is required').isEmail();
  req.checkBody('password_', 'Password is required');

  var errors = req.validationErrors();

  if(errors){
    req.session.errors = errors;
    req.session.success = false;

  }
  else {

    var sql = "INSERT INTO Users (user_email, user_password, isAdmin) VALUES ?";
    var value = [
      [req.body.user_email_, req.body.password_, false]
    ];
    db.query(sql,[value], function(err,result) {

      if(err) throw err;
      console.log("inserted rows: " + result.affectedRows);
  });
  req.session.success = true;
  res.redirect('/');
  }
});

app.post('/login', (req, res) => {

  var useremail = req.body.user_email_;
  var password = req.body.password_;

  db.query("SELECT * FROM Users WHERE (user_email) = ?",[useremail],
    function(err, rows) {
    if (err) throw err;

    rows.forEach(function(result){

      //console.log(result);
      //console.log(result.user_email);
      if(result.user_email == useremail && result.user_password == password){
        req.session.user = result;
      }
      //Check user and password befoe session
      //console.log(req.session.user.user_email, req.session.user.user_password);
    });
    res.redirect('/');
  });
});


app.post('/add-product', (req, res) => {

  // Check needs to be updated
  req.checkBody('productName', 'Product name is required');
  req.checkBody('productPrice', 'Product price is required');
  req.checkBody('productDesc', 'Product description is required');
  req.checkBody('productStock', 'Product in stock is required');

  var errors = req.validationErrors();

  if(errors){
    throw errors;
  }
  else {

    var sql = "INSERT INTO Products (product_name, product_price, product_desc, product_stock) VALUES ?";
    var value = [
      [req.body.productName, req.body.productPrice, req.body.productDesc, req.body.productStock]
    ];
    db.query(sql,[value], function(err,result) {
      if(err) throw err;
      console.log("Product inserted rows: " + result.affectedRows);
    });

  res.redirect('/');
  }
});



app.listen(3000, () => {
  console.log('Server started on port 3000');
});
