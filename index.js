const express = require("express")
const axios = require("axios")
const pg = require("pg")

const app = express()

app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded());
app.set("view engine", "ejs");

const db = new pg.Client({
  user: "postgres",
  host: "database-3.cjg8eayy236w.us-east-1.rds.amazonaws.com",
  database: "mybooknotes",
  password: "JNqPLdVeb7DQYMJQoD2F",
  port: 5432,
  ssl: {
    rejectUnauthorized: false // This is required for render.com's SSL configuration
  }
});
db.connect();

async function getBooks() {
  const result = await db.query("SELECT * FROM book");
  return result.rows;
}

// Function to fetch book details from Open Library API
async function fetchBookDetails(isbn) {
  try {
    const response = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
    const bookData = response.data[`ISBN:${isbn}`];
    return {
      title: bookData.title,
      author: bookData.authors ? bookData.authors[0].name : "Unknown Author",
      publish_date: bookData.publish_date,
      cover_image: bookData.cover ? bookData.cover.medium : null
    };
  } catch (error) {
    console.error("Error fetching book details:", error);
    return null;
  }
}
app.get("/", async (req, res) => {
  try {
      let sortField = req.query.sortBy || "rating"; // Default sorting by rating if sortBy is not provided
      let sortOrder = sortField === "rating" ? "DESC" : "DESC"; // Change to ASC if sorting by recent
      if (sortField === "recent") {
          sortField = "publish_date"; // Assuming there's a field named publish_date in your book table
          sortOrder = "DESC"; // Change to ASC if needed
      }
      const query = `SELECT * FROM book ORDER BY ${sortField} ${sortOrder}`;
      const result = await db.query(query);
      const books = result.rows;
      res.render("index.ejs", { books });
  } catch (error) {
      console.error("Error fetching books:", error);
      res.status(500).send("Error fetching books");
  }
});

app.post("/add",(req,res)=>{
  res.render("add.ejs")
})

// Endpoint to add a book with details fetched from Open Library API
app.post("/addbook", async (req, res) => {
  const { isbn,review,rating } = req.body;

  try {
    // Fetch book details from Open Library API
    const bookDetails = await fetchBookDetails(isbn);

    if (!bookDetails) {
      return res.status(404).send("Book details not found");
    }

    // Add book to database
    const query = {
      text: "INSERT INTO book (title, author,isbn,review,rating, publish_date, cover_image) VALUES ($1, $2, $3, $4,$5,$6,$7)",
      values: [bookDetails.title, bookDetails.author,isbn,review,rating, bookDetails.publish_date, bookDetails.cover_image],
    };

    await db.query(query);
    console.log("Book added successfully");
    res.redirect("/");
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Error adding book");
  }
});


app.post("/edit/:idnumber",async(req,res)=>{
  const { isbn,review,rating } = req.body;
  const requstedId = req.params.idnumber
  try{
    const result = await db.query("SELECT * FROM book WHERE id = $1",[
      requstedId
    ])
    const bookToEdit = result.rows[0]
    if (bookToEdit) {
      // Send JSON response with book data
      res.render("edit",{ book: bookToEdit });
    } else {
      // Book not found, send 404 status
      res.status(404).json({ error: "Book not found" });
    }
  } catch (error) {
    console.error("Error editing book:", error);
    // Send 500 status for internal server error
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/update/:idnumber",async function(req,res){
  const requestedId = req.params.idnumber
  const { isbn,review,rating } = req.body;
  try{
    const result = await db.query("UPDATE book SET isbn = $1, review = $2, rating = $3 WHERE id = $4 RETURNING*",
  [isbn,review,rating,requestedId])
  if(result.rowCount>0){
    res.redirect("/")
  }
}catch(error){
    console.error(error)
  }
})

app.post("/delete/:idnumber",async(req,res)=>{
  const requestedId = req.params.idnumber
  const { isbn,review,rating } = req.body;
  try{
    const result = await db.query("DELETE FROM book WHERE id=$1",[
      requestedId,
    ]);if(result.rowCount>0){
      res.redirect("/")
    }
  }catch(error){console.error(error)}
} )

app.listen(3000,()=>{
    console.log("Server is running on port 3000")
})