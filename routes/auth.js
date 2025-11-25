const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../middleware/auth");

module.exports = (client, collections) => {
  const router = express.Router();
  const { users, profiles, purchases, store } = collections;

  router.post("/register", async (req, res) => {
    const session = client.startSession();
    session.startTransaction();
    const { username, password } = req.body;
    const usernameCaseInsensitive = username.toLowerCase();
    const { validateRegistrationInput } = require("../utils/validateUserInput");

    // Validate user inputs
    const errors = validateRegistrationInput({ username, password });

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      // Check if user with username already exists
      const existingUser = await users.findOne({ usernameCaseInsensitive });

      if (existingUser) {
        return res
          .status(400)
          .json({ error: "Account with username already registered" });
      }
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();
      // Add new user (username, password, createdAt)
      const result = await users.insertOne({
        username: usernameCaseInsensitive,
        password: hashedPassword,
        createdAt,
      });

      // Add new profile to profiles collection

      const newProfile = {
        _id: result.insertedId,
        username: usernameCaseInsensitive,
        onBoarded: false,
        timezone: '',
        selectedClass: '',
        customDescription: '',
        profileImage: null,
        createdAt,
        lastActive: createdAt,
        theme: "light",
        balance: 0,
      };
      const { _id, ...rest } = newProfile;

      const userId = result.insertedId;

      await Promise.all([
        profiles.insertOne(newProfile),
        store.insertOne({ _id: userId, store: [] }),
        purchases.insertOne({ _id: userId, purchases: [] }),
      ]);

      await session.commitTransaction();

      // Create jwt token
      const token = jwt.sign(
        { userId: result.insertedId, username: usernameCaseInsensitive },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        message: "User registered successfully",
        token,
        profile: rest,
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("Registration failed:", error);
      res
        .status(500)
        .json({ error: "Registration failed", details: error.message });
    } finally {
      session.endSession();
    }
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const { validateLoginInput } = require("../utils/validateUserInput");
    const usernameCaseInsensitive = username.toLowerCase();

    // Validate inputs
    const errors = validateLoginInput({ username, password });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const user = await users.findOne({ username: usernameCaseInsensitive });

      if (!user) {
        return res.status(401).json({ error: "Invalid Credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect Credentials" });
      }

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const profile = await profiles.findOne({ _id: user._id });

      if (!profile) {
        return res.status(401).json({ error: "Profile does not exist" });
      }

      const { _id, ...rest } = profile;

      return res.status(200).json({
        message: "User logged in successfully",
        token,
        profile: rest,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/profile", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);

    try {
      const user = await users.findOne({ _id: userId });

      if (!user) {
        return res.status(401).json({ error: "User does not exist" });
      }

      const profile = await profiles.findOne({ _id: userId });

      if (!profile) {
        return res.status(401).json({ error: "Profile does not exist" });
      }

      const { _id, ...rest } = profile;

      return res.json({
        ...rest,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/profile/balance", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);
    const { balance } = req.body;

    try {
      const user = await users.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return res.status(401).json({ error: "User does not exist" });
      }

      const profile = await profiles.findOne({ _id: new ObjectId(userId) });

      if (!profile) {
        return res.status(401).json({ error: "Profile does not exist" });
      }

      const response = await profiles.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { balance } }
      );

      if (response.modifiedCount > 0) {
        return res
          .status(200)
          .json({ success: true, message: "User balance updated" });
      }
    } catch (error) {
      return res.status(500).json({ error });
    }
  });

  router.get("/store", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);

    try {
      // Check if user with _id exists in profiles collection
      const storeDoc = await store.findOne({ _id: userId });

      if (!storeDoc) {
        return res.status(401).json({ error: "Store does not exist" });
      }
      const { _id, ...rest } = storeDoc;
      // Return inventory data
      return res.json({
        ...rest.store,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/store/update", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);
    const { updatedStore } = req.body;

    try {
      const storeDoc = await store.findOne({ _id: userId });
      if (!storeDoc) {
        return res.status(401).json({ error: "store does not exist" });
      }

      const response = await shop.updateOne(
        { _id: userId },
        { $set: { store: updatedStore } }
      );

      if (response.matchedCount === 0) {
        return res.status(404).json({ error: "Could not update store" });
      }

      res.json({ message: "store updated successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/purchases", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);

    try {
      const user = await users.findOne({ _id: userId });

      if (!user) {
        return res.status(401).json({ error: "User does not exist" });
      }
      // Check if user with _id exists in purchases collection
      const purchasesList = await purchases.findOne({ _id: userId });

      if (!purchasesList) {
        res.status(401).json({ error: "Purchases do not exist" });
      }
      // Return purchases data

      const { _id, ...rest } = purchasesList;
      return res.json({ ...rest.purchases });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/purchases/update", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);
    const { updatedPurchases } = req.body;

    try {
      const purchasesDoc = await purchases.findOne({ _id: userId });
      if (!purchasesDoc) {
        return res.status(401).json({ error: "purchases does not exist" });
      }

      const response = await purchases.updateOne(
        { _id: userId },
        { $set: { purchases: updatedPurchases } }
      );

      if (response.matchedCount === 0) {
        return res.status(404).json({ error: "Could not update purchases" });
      }

      res.json({ message: "purchases updated successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/profile/update", authenticateToken, async (req, res) => {
    const { ObjectId } = require("bson");
    const userId = new ObjectId(req.user.userId);
    const updatedProfile = req.body.updatedProfile;

    try {
      const user = await users.findOne({ _id: userId });
      if (!user) {
        return res.status(401).json({ error: "User does not exist" });
      }

      const profile = await profiles.findOne({ _id: userId });
      if (!profile) {
        return res.status(401).json({ error: "Profile does not exist" });
      }

      const response = await profiles.updateOne(
        { _id: userId },
        { $set: updatedProfile }
      );

      if (response.matchedCount === 0) {
        return res.status(404).json({ error: "Could not update profile" });
      }

      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
};
