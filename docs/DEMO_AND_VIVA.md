# Demonstration and viva guide

## Three-minute demonstration

**0:00–0:30 — Problem:** “In a student mess, meal counts, deposits and grocery purchases are often written in different places. This can create disagreements at the end of the month. MessMate keeps the records together and explains the bill.”

**0:30–1:00 — Records:** Open Members, add a member, then use Meal tracker. Explain that each meal is one unit and guest meals can be recorded under the host.

**1:00–1:40 — Money:** Record a deposit and submit a grocery purchase. Show the fund/personal payment source, pending status and manager review.

**1:40–2:20 — Reconciliation:** Open Settlement. Explain food share, equal shared costs, deposits and personal-purchase credits. Show that the values sum correctly, including rounding.

**2:20–3:00 — Trust:** Raise a question, resolve it, show the activity log and export CSV. Use a completed month to demonstrate finalization. Explain that locked months cannot be silently changed.

Use sample or local test records for a presentation. Never finalize a real accounting month just for a demo.

## Suggested presentation outline

1. Title and team
2. Real-life problem and intended users
3. Objectives and scope
4. Functional requirements
5. Architecture and storage model
6. Meal-cost formula and rounding
7. Core workflow demonstration
8. Security and testing
9. Limitations and future improvements
10. Conclusion and questions

## Viva questions

**What makes this more than a CRUD application?**
It applies accounting rules, permissions, meal deadlines, expense approvals, dispute resolution, atomic version checks and immutable month-end snapshots.

**Why store money as integer paisa?**
Binary floating-point values may not represent decimal money exactly. Storing whole paisa lets the app conserve totals and use a clear rounding algorithm.

**How do you calculate food cost?**
Multiply approved food spending by a member's meal count and divide by total meals. Allocate remaining paisa using the largest fractional remainders.

**Why do you distinguish personal purchases and the mess fund?**
A personal purchase needs to credit the person who paid. It must not also be deducted from the shared cash fund, which would count the payment twice.

**What is optimistic concurrency?**
Every update includes the version the user last read. The database saves the update only if that version is still current. Otherwise the API returns 409, and the user reloads.

**What is authentication versus authorization?**
Authentication identifies a person. Authorization decides whether that person can access a household or perform a manager action. Both are checked on the server.

**Is your database normalized?**
No. The physical database stores one household document per row. This keeps a small household change atomic, but has a bounded size and limited query scalability. The design document explains the normalized alternative.

**What happens if an expense is disputed?**
The question is stored and recorded in history. The manager must resolve it before the month can close. Its approved amount remains visible while review is pending; unresolved issues are explicitly shown.

**How is a wrong deposit corrected?**
The manager records a correction with a reason. The history includes old and new details. A duplicate can be voided, retaining its record while excluding its amount from balances.

**Does the app process payments?**
No. It records payments that already happened and calculates outstanding balances. It does not send money or automatically carry credits into the next month.

**What did you test?**
Accounting conservation, permissions, deadlines, corrections, locked months, API persistence, concurrent-write conflicts, household isolation, upload checks and responsive behavior. See the test report for actual results and untested areas.

**How would you improve it?**
Normalize the database for larger usage, add member departures and explicit invitation acceptance, then consider reminders and controlled balance carry-forward after defining their business rules.

## বাংলা ব্যাখ্যা

মিলের খরচ = অনুমোদিত খাবারের মোট খরচ × একজন সদস্যের মিল ÷ সবার মোট মিল। এরপর ভাড়া ও ইউটিলিটির সমান অংশ যোগ হবে। সদস্যের জমা টাকা এবং নিজের পকেট থেকে করা অনুমোদিত বাজার খরচ বাদ যাবে। যা থাকবে সেটিই তার বকেয়া বা ফেরত পাওনা।

কোনো তথ্য বদলানোর আগে সার্ভার দেখে ব্যবহারকারীর অনুমতি আছে কি না, মাসটি বন্ধ হয়েছে কি না, এবং এর মধ্যে অন্য কেউ নতুন তথ্য সংরক্ষণ করেছে কি না। তাই শুধু UI-তে বোতাম লুকিয়ে নিরাপত্তা দেওয়া হয়নি।
