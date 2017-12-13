const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const expressValidator = require('express-validator');
const MySQLStore = require('express-mysql-session')(session);
const faker = require('faker');
const Cart = require('./models/cart.js');

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

    var cart = new Cart(req.session.cart ? req.session.cart : {});
    req.session.cart = cart;

    if(req.session.user == undefined){
    res.render('index', {
      title: 'Not logged in',
      success: req.session.success,
      errors: req.session.errors,
      isUserValid: false,
      products: rows,
      nameShown: '',
      qty: req.session.cart.totalQty
    });
  }
  else{
    res.render('index', {
      title: 'Welcome Customer!',
      success: req.session.success,
      errors: req.session.errors,
      isUserValid: true,
      products: rows,
      nameShown: req.session.user.user_email,
      qty: req.session.cart.totalQty
    });
  }
});
});

app.get('/cart',(req, res) => {
  var cart = new Cart(req.session.cart);
//  var products1 = cart.generateArray();

//  console.log(cart.items);
//  console.log(products1);
//  console.log(products[1].item.product_name);
//  console.log(products.length);

  res.render('cart', {
  title: 'My Cart',
  products: cart.generateArray(),
  totalPrice: cart.totalPrice
  });
});
app.get('comments:id'), (req, res) => {
  var name_product = req.params.id;
  console.log(name_product);


}


app.get('/edit-User', (req, res) => {
  res.render('main/edit-User');
});

app.get('/home',(req, res) => {
  res.redirect('/');
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
// might need to be change to search for product id instead of name
app.get('/add-tocart/:id', (req, res) => {
  var name_product = req.params.id;
  console.log(name_product);
  var cart = new Cart(req.session.cart ? req.session.cart : {});

  db.query("SELECT * FROM Products WHERE (product_name) = ?",[name_product],
  function(err, rows){
    if(err) throw err;


    rows.forEach(function(result){

    cart.add(result, result.product_id);
    req.session.cart = cart;
    console.log(req.session.cart);
    res.redirect('/');
    });
  });
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
      [req.body.user_email_, req.body.password_, true]
    ];
    db.query(sql,[value], function(err,result) {

      if(err) throw err;
      console.log("inserted rows: " + result.affectedRows);

  });


  db.query("SELECT user_id FROM Users ORDER BY user_id DESC LIMIT 1",
  function(err, result){
    if(err) throw err;

    console.log(Object.values(result[0]));

//    rows.forEach(function(result){
      var value = [
        Object.values(result[0])
      ];
      var sql = "INSERT INTO Orders (customer_id) VALUES ?";
      db.query(sql,[value], function(err, result) {
      if(err) throw err;
    });

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

app.post('/cart', (req, res) => {
	if(req.session.user == undefined){
	res.redirect('/login');
}
  console.log('nothing in chechout happened');
  res.redirect('/')

});







app.listen(3000, () => {
  console.log('Server started on port 3000');
});
