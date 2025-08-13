require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
var admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

//firebase

// var serviceAccount = require("./config/firebase-adminsdk.json");

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY_ADMIN,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URI,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://simple-firebase-auth-e8c44.web.app",
    ],
    credentials: true,
  })
);
app.get("/", (req, res) => {
  res.send("Athletic Hub");
});

const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASS}@cluster0.1pqy4da.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// jwtMiddleware
const fBVerify = async (req, res, next) => {
  // const authHeader = req?.headers?.authorization
  const token = req?.headers?.authorization?.split(" ")[1];

  // console.log(token, "token1");
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // console.log(decoded.email);
    req.user = decoded.email;
    // console.log(decoded,'decoded');
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized" });
  }
};
// jwt.sign();
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const athleticCollection = client.db("athletic-hub").collection("athletic");
    const bookMarkCollection = client.db("athletic-hub").collection("bookmark");
    const usersCollection = client.db("athletic-hub").collection("user");
    // jwt token
    app.post("/jwt", (req, res) => {
      const user = { email: req.body.email };
      // create token
      const token = jwt.sign(user, process.env.PRIVATE_KEY, {
        expiresIn: "7d",
      });
      res.send(token);
    });

    app.get("/athletic", async (req, res) => {
      const result = await athleticCollection.find().toArray();
      res.send(result);
    });
    app.get("/manageEvent", fBVerify, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.user;
      // console.log(email, decodedEmail);
      if (email !== decodedEmail) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const filter = { creatorEmail: email };
      const result = await athleticCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/athletic/:id",  async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const result = await athleticCollection.findOne(filter);
      // // console.log(req.user, result);
      // if (!result) {
      //   return res.status(404).send({ message: "Not found" });
      // }
      // if (!req.user) {
      //   return res.status(403).send({ message: "Forbidden" });
      // }
      res.send(result);
    });
    //   post
    app.post("/athletic", fBVerify, async (req, res) => {
      const myPost = req.body;
      const result = await athleticCollection.insertOne(myPost);
      res.send(result);
    });
    app.delete("/athletic/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await athleticCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/athletic/:id", fBVerify, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateData = req.body;

        const updateDoc = { $set: updateData };

        const result = await athleticCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ message: "No document found to update" });
        }

        res.send(result);
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // bookMarkCollection
    app.get("/myBooking", fBVerify, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req?.user;
      // console.log(email, typeof(email), decodedEmail);
      if (email !== decodedEmail) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const query = { user_email: email };
      const result = await bookMarkCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/bookmark", fBVerify, async (req, res) => {
      const myBook = req.body;
      myBook.user_email = req.user;
      const result = await bookMarkCollection.insertOne(myBook);
      res.send(result);
    });

    app.delete("/myBooking/:id", fBVerify, async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      const decodedEmail = req.user;

      if (email !== decodedEmail) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const query = { _id: new ObjectId(id) };
      // console.log(query);
      const result = await bookMarkCollection.deleteOne(query);
      // console.log("delete result",result);
      res.send(result);
    });

    // userCollection
    // app.post("/login", async (req, res) => {
    //   const { email, password } = req.body;

    //   const user = await usersCollection.findOne({ email });

    //   if (!user || user.password !== password) {
    //     return res.status(401).send({ error: "Invalid credentials" });
    //   }

    //   const token = generateToken({ email: user.email });

    //   res.send({ token });
    // });

    app.get("/protected", fBVerify, (req, res) => {
      const user = req.user; // decoded Firebase user
      res.send({ message: "Access granted", user });
    });
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(` app listening on port ${port}`);
});
