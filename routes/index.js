const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const expressValidator = require('express-validator');
const MySQLStore = require('express-mysql-session')(session);
const faker = require('faker');

const Cart = require('../models/cart.js');

const router = express.Router();

// Create connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'db_movie'
});
const sessionStore = new MySQLStore({}, db);

//Check createConnection
db.connect((err) => {
  if(err) throw err;
  console.log('MySQL Connected...');
});

// Render Homepage
router.get('/', (req, res) => {

  console.log("SessionId = " +req.sessionID + " UserInf = " +req.session.user);
//  console.log(req.session.user);
  req.session.errors = null;
  req.session.success = null;
  db.query("SELECT * FROM Products",
    function(err, rows) { if (err) throw err;

      //Create new or existing session
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

// Render the page for new user to register
router.get('/register',(req, res) => {

  // this means there exists no admin user, lets create one
  db.query("SELECT user_id from Users WHERE isAdmin = true",
  function(err, result){
    if(err){
      res.render('register');
    }
    //console.log(result);
    if(result[0] == undefined){
      db.query("INSERT INTO Users (user_email, user_password, isAdmin) VALUES ('admin@admin.com', 'password', true)");
    }
  });

  res.render('register');
});

// Render the commentpage with the selected product
router.get('/comments/:id', (req, res) => {
  var name_product = req.params.id;


  db.query("SELECT * FROM ProductComments WHERE (product_id) = ?",[name_product],
  function(err, result){

    //console.log(result);
    //console.log("iD = " + name_product);
    //console.log(req.session.user);

    if(req.session.user == undefined){
      res.render('main/comments',{

        username_comment: "anonymous",
        title: name_product,
        allcomments: result,
        isLoggedIn: false,
        isUserAdmin: false,
        likedProductYet: true,
        prodID: name_product,
      });

    }
    else{
      db.query("SELECT product_id FROM ProductGrades WHERE (customer_id) = ? AND (product_id) = ?", [req.session.user.user_id, name_product],
      function(err, gradeResult){

        if(gradeResult[0] == undefined){

          res.render('main/comments',{

            username_comment: req.session.user.user_email,
            title: name_product,
            allcomments: result,
            isLoggedIn: true,
            isUserAdmin: req.session.user.isAdmin,
            likedProductYet: false,
            prodID: name_product,
          });
        }else{

          res.render('main/comments',{

            username_comment: req.session.user.user_email,
            title: name_product,
            allcomments: result,
            isLoggedIn: true,
            isUserAdmin: req.session.user.isAdmin,
            likedProductYet: true,
            prodID: name_product,
          });
        }

      });
    }
  });
});

// Render admin's edit user page
router.get('/edit-User', (req, res) => {
  res.render('main/edit-User');
});

// Redirect to homepage
router.get('/home',(req, res) => {
  res.redirect('/');
});

// Render the page for user to login
router.get('/login',(req, res) => {
  res.render('login');
});

// Render the cart page with the session
router.get('/cart',(req, res) => {

  // Fetch and create at already existing cart
  var cart = new Cart(req.session.cart);

  db.query("SELECT product_price FROM Products", (err, result) => {
    //console.log(result[0].product_price);
    //console.log(theproducts);
    res.render('cart', {
      title: 'My Cart',
      products: cart.generateArray(),
      databasePrice: result
    });
  });
});

// Used for redirecting to homepage after user logout
router.get('/logout', (req, res) => {
  var cart = new Cart(req.session.cart);

  if(req.session.user != undefined){
    req.session.destroy();
  };
//  return res.status(200);
  res.redirect('/');
});

// Used for empty user's cart
router.get('/empty', (req, res) => {

  var cart = new Cart(req.session.cart);
  products = cart.generateArray();

  for (var i = 0; i < products.length; i++) {
    var quant = products[i].qty;
    var id = products[i].item.product_id;

    db.query("UPDATE Products SET product_stock = product_stock + ? WHERE (product_id) = ?",
    [quant, id]);
  }
  req.session.cart = {};
  res.redirect('/');
});

// might need to be change to search for product id instead of name
router.get('/add-tocart/:id', (req, res) => {

  var name_product = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});

  db.query("SELECT * FROM Products WHERE (product_name) = ?",[name_product],
  function(err, rows){  if(err) throw err;

    rows.forEach(function(result){

      db.query("UPDATE Products SET product_stock = product_stock -1 WHERE (product_id) = ?", [result.product_id]);
      cart.add(result, result.product_id);
      req.session.cart = cart;

    res.redirect('/');
    });
  });
});

router.get('/comments/delete/:id', (req, res) => {

  var theCommentID = req.params.id;

  db.query("DELETE FROM ProductComments WHERE (comment_id) = ?", [theCommentID]);

  db.query("UPDATE ProductComments SET comment_id = comment_id - 1 WHERE (comment_id) > ?", [theCommentID]);

  db.query("SELECT comment_id FROM ProductComments ORDER BY comment_id DESC LIMIT 1",
  function(err, result){  if(err) throw err;

    db.query("ALTER TABLE ProductComments AUTO_INCREMENT = ?", [Object.values(result[0])]);
  });

  res.redirect('/');

});


router.get('/comments/like/:id', (req, res) => {

  var prodID = req.params.id;

  var sql = "INSERT INTO ProductGrades (grade_positive, customer_id, product_id) VALUES ?";
  var value = [
    [true, req.session.user.user_id, prodID]
  ];
  db.query(sql,[value], function(err,result) {
    if(err){
      res.redirect('main/error');
    }
    console.log("Liked the product ");
  });


  res.redirect('/');
});

router.get('/error', (req, res ) => {

  res.render('main/error', {
    title: "error",
  });
});

module.exports = router;
