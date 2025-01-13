require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("bistro boss is sitting");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.98vvu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db("bistroBoss").collection("users");
    const menuCollection = client.db("bistroBoss").collection("menu");
    const reviewCollection = client.db("bistroBoss").collection("reviews");
    const cartCollection = client.db("bistroBoss").collection("carts");

    // jwt related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    });

    const verifyToken = (req, res, next) =>{
      if(!req.headers.authorization){
        return res.status(401).send({message: "Forbidden Access"})
      }
      const token = req.headers.authorization.split(' ')[1];
      console.log('inside verifyToken', token);
      jwt.verify(token, process.env.JWT_TOKEN, (error, decoded) =>{
        if(error){
          return res.status(401).send({message: 'Forbidden Access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      next();
    }

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email',verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email) {
        return res.status(403).send({message: "Unauthorized Access"})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let admin = false;
      if(user) {
        admin = user?.role === 'admin'
      }
      res.send({admin});
    })
    // user protection
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "user already in the db",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // make admin
    app.patch("/users/admin/:id",verifyToken,verifyAdmin, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // delete user
    app.delete("/users/:id",verifyToken, verifyAdmin, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // getting menu items
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    // posting a cart item
    app.post("/carts", async (req, res) => {
      const result = await cartCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    //
    app.delete("/carts/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`bistro boss is running at port ${port}`);
});
