const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const expressValidator = require('express-validator');
const MySQLStore = require('express-mysql-session')(session);
const faker = require('faker');


const Cart = require('./models/cart.js');
const routes = require('./routes/index.js');


const router = express.Router();

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



app.use('/', routes);


// Render the page for admin to a a new product? Code possible bad
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


app.get('/updateprice/:id', (req, res) => {

  var id_product = req.params.id;
  var cart = new Cart(req.session.cart);
  theproducts = cart.generateArray()

  db.query("SELECT product_price FROM Products WHERE (product_id) = ?",[id_product], (err, result) => {

    //console.log(id_product);
    //console.log("result!!");
    //console.log(cart.items[1].item.product_id);

    cart.items[id_product].item.product_price = result[0].product_price;

    req.session.cart = cart;

  res.redirect('/cart');
  });
});

app.get('/orderHistory', (req, res) => {

  db.query("SELECT * FROM Orders", function(err, allOrders){

    db.query("SELECT * FROM ShoppingBasket", function(err, allShopping){

      db.query("SELECT * FROM Users", function(err, allUsers){


        res.render('main/order-history', {
          title: "History",
          theUsers: allUsers,
          theShopping: allShopping,
          theOrders: allOrders,

        });

      });
    });
  });
})



// might need to be change to search for product id instead of name
app.get('/add-tocart/:id', (req, res) => {

  var name_product = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});

  db.query("SELECT * FROM Products WHERE (product_name) = ?",[name_product],
  function(err, rows){
    if(err) throw err;

    rows.forEach(function(result){

      db.query("UPDATE Products SET product_stock = product_stock -1 WHERE (product_id) = ?", [result.product_id]);
      cart.add(result, result.product_id);
      req.session.cart = cart;
      //console.log(req.session.cart);
      res.redirect('/');
    });
  });
});

// Render the edit page for the specific product
app.get('/edit/:id', (req, res) => {

  var name = req.params.id;

  db.query("SELECT * FROM Products WHERE product_name = ?", [name],
  function(err, result){

    //console.log(result[0]);
    res.render('main/edit-product',{

      product: result,
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
      [req.body.user_email_, req.body.password_, false]
    ];
    db.query(sql,[value], function(err,result) {

      if(err) throw err;
      console.log("inserted rows: " + result.affectedRows);
    });

  db.query("SELECT user_id FROM Users ORDER BY user_id DESC LIMIT 1",
  function(err, result){
    if(err) throw err;

    //console.log(Object.values(result[0]));

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
  };
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
  else{
    db.query("SELECT order_id FROM Orders WHERE (customer_id) = ? ORDER BY order_id DESC limit 1",[req.session.user.user_id],
      function(err, result) {
      if (err) throw err;

      var cart = new Cart(req.session.cart);

      products = cart.generateArray();


      for (var i = 0; i < products.length; i++) {
        var count = products[i].qty;
        var orderID = Object.values(result[0]);
        var prodID = products[i].item.product_id;
        var prodPrice = products[i].item.product_price;

       var sql = "INSERT INTO ShoppingBasket (order_id, product_count, product_id, product_price) VALUES ?";
        var value = [
          [orderID[0], count, prodID, prodPrice]
       ];

        db.query(sql,[value]);
        db.query("UPDATE Products SET product_stock = product_stock - ? WHERE (product_id) = ?", [count, prodID]);

        //console.log(req.session.user.user_id);
      }
    });
    db.query("INSERT INTO Orders (customer_id) VALUES (?)", [req.session.user.user_id]);
    res.redirect('/empty');
  }
});

app.post('/edit/:id', (req, res) => {

  var name = req.params.id;

  db.query("SELECT * FROM Products WHERE product_name = ?", [name],
  function(err, result){

    var productID = result[0].product_id;

    db.query("UPDATE Products SET product_name = ?, product_price = ?,product_desc = ?,product_stock = ? WHERE (product_id) = ?",
    [req.body.productName, req.body.productPrice, req.body.productDesc, req.body.productStock,productID]);

  });
  res.redirect('/');
});

app.post('/cart/update', (req, res) => {
  console.log("Updating......");
});


app.listen(3000, () => {
  console.log('Server started on port 3000');
});
