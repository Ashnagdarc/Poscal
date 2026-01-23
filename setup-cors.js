// Script to add CORS origins to Supabase
// Run this from your Supabase project or use the dashboard

const corsOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://www.poscalfx.com",
  "https://poscalfx.com",
  "https://poscal-alpha.vercel.app"
];

console.log("Add these origins to your Supabase CORS settings:");
console.log("================================================\n");

corsOrigins.forEach(origin => {
  console.log(`- ${origin}`);
});

console.log("\n\nInstructions:");
console.log("1. Go to: https://supabase.poscalfx.com");
console.log("2. Navigate to: Settings → API → CORS");
console.log("3. Add each origin listed above");
console.log("4. Save changes");
console.log("\nOr use the Supabase CLI:");
console.log("supabase projects api-settings update --cors-allowed-origins=http://localhost:8080,https://www.poscalfx.com");
