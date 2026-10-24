# e-GP Auto Fetcher (Microsoft Edge Extension)

Microsoft Edge-এ কোনো **start.bat** বা **Python সার্ভার চালু না করেই** সরাসরি e-GP (eprocure.gov.bd) থেকে টেন্ডার ডাটা ফেচ করার এক্সটেনশন।

---

## 🚀 ইন্সটলেশন ও সেটআপ (মাত্র ২ টি ধাপ):

### ধাপ ১: এক্সটেনশন লোড করুন
1. **Microsoft Edge** ব্রাউজার ওপেন করে এড্রেস বারে যান: `edge://extensions`
2. বাম পাশের নিচে **"Developer mode" (ডেভেলপার মোড)** অন করুন।
3. উপরে **"Load unpacked"** বাটনে ক্লিক করুন।
4. এই ফোল্ডারটি সিলেক্ট করুন:  
   `C:\Users\Tanzil Ahmed\Downloads\Credit Commitment\edge-extension`

### ধাপ ২: ফাইল ইউআরএল পারমিশন অন করুন (জরুরি) ⚠️
যেহেতু `Credit Commitment.html` ফাইলটি কম্পিউটার থেকে সরাসরি ওপেন করা হয় (`file:///`), তাই নিচের অপশনটি অন করতে হবে:
1. `edge://extensions` পেজে **"e-GP Auto Fetcher (Credit Commitment)"** কার্ডের নিচে **"Details" (বিস্তারিত)** বাটনে ক্লিক করুন।
2. স্ক্রল করে নিচে নামুন এবং **"Allow access to file URLs" (ফাইল ইউআরএল-এ অ্যাক্সেসের অনুমতি দিন)** অপশনটি **ON** (Enable) করে দিন।

---

## ⚡ কিভাবে ব্যবহার করবেন:
1. `Credit Commitment.html` ফাইলটি Edge ব্রাউজারে ওপেন করুন (বা রিলোড দিন)।
2. **Tender ID** লিখে **Enter** চাপুন অথবা **"Fetch All Tender"** বাটনে ক্লিক করুন।
3. সাথে সাথে e-GP থেকে সব তথ্য (Package No, IFT, Description, Amount, Recipient) এসে যাবে!
