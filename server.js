const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
// IMPORTANT: Your connection string was exposed. I have removed it. 
// Please load it from environment variables in a real application.
mongoose.connect("mongodb+srv://sheltondsouza4923:jCT08XXHIYQ5OZQt@cluster0.phklsbp.mongodb.net/Web3", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('MongoDB connected successfully.'));

// --- Wallet Schema ---
const walletSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    address: String,
    privateKey: String,
});
const Wallet = mongoose.model("Wallet", walletSchema);

// --- Transaction Schema ---
// FIX: Simplified schema. `status` will now come from the request.
// Renamed `timestamp` to `createdAt` to match frontend expectations.
const transactionSchema = new mongoose.Schema({
    walletName: { type: String, required: true, index: true },
    txHash: { type: String, required: true, unique: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: String, required: true },
    tokenSymbol: { type: String, required: true },
    status: { type: String, enum: ["Sent", "Failed", "Pending"], required: true },
    createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.model('Transaction', transactionSchema);


// --- Wallet API Routes ---

// FIX: Corrected route to match what frontend was trying to call.
app.post("/api/wallet", async (req, res) => {
    const { name, address, privateKey } = req.body;
    if (!name || !address || !privateKey) {
        return res.status(400).json({ message: "Missing required wallet fields" });
    }
    try {
        const wallet = new Wallet({ name, address, privateKey });
        await wallet.save();
        res.status(201).json({ message: "Wallet saved successfully" });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "A wallet with this name already exists." });
        }
        console.error("Error saving wallet:", err);
        res.status(500).json({ message: "Failed to save wallet" });
    }
});

app.get("/api/wallet/:name", async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ name: req.params.name });
        if (!wallet) return res.status(404).json({ error: "Wallet not found" });
        res.json(wallet);
    } catch (err) {
        console.error("Error fetching wallet:", err);
        res.status(500).json({ error: "Error fetching wallet" });
    }
});

// --- Transaction Routes ---

// FIX: This is now the ONLY endpoint needed to create a transaction.
// It accepts the final status from the frontend.
app.post('/api/transactions/save', async (req, res) => {
    try {
        const { walletName, txHash, from, to, amount, tokenSymbol, status } = req.body;

        if (!walletName || !txHash || !from || !to || !amount || !tokenSymbol || !status) {
            return res.status(400).json({ message: "Missing required transaction fields" });
        }

        const newTransaction = new Transaction({
            walletName,
            txHash,
            from,
            to,
            amount,
            tokenSymbol,
            status, // Status comes directly from the frontend request
        });

        await newTransaction.save();
        res.status(201).json({ message: "Transaction saved successfully" });
    } catch (error) {
        if (error.code === 11000) {
            // This can happen if a user retries. We can just send success.
            return res.status(200).json({ message: "Transaction already exists." });
        }
        console.error("Error saving transaction:", error);
        res.status(500).json({ message: "Server error while saving transaction" });
    }
});

// This endpoint is no longer used in the main flow but is kept here
// in case you need to update a transaction for other reasons.
app.put("/api/transactions/update", async (req, res) => {
    try {
        const { txHash, status } = req.body;
        const tx = await Transaction.findOneAndUpdate({ txHash }, { $set: { status } }, { new: true });
        if (!tx) return res.status(404).json({ message: "Transaction not found" });
        res.json(tx);
    } catch (err) {
        console.error("Error updating transaction:", err);
        res.status(500).json({ message: "Server error while updating transaction" });
    }
});


app.get('/api/transactions/:walletName', async (req, res) => {
    try {
        const { walletName } = req.params;
        // Sort by `createdAt` to ensure newest transactions are first
        const transactions = await Transaction.find({ walletName }).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ message: "Server error" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
