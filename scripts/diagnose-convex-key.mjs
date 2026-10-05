const key = process.env.CONVEX_DEPLOY_KEY ?? "";
console.log(
  "[convex-key-check]",
  JSON.stringify({
    present: Boolean(key),
    prefix: key.slice(0, 5),
    hasPipe: key.includes("|"),
    length: key.length,
  }),
);
process.exit(1);
