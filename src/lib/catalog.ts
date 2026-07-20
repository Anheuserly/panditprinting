const endpoint = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID || "680b2b830035595d7746";
const databaseId = process.env.APPWRITE_DATABASE_ID || "680b2cfb002805548743";
const collectionId = process.env.APPWRITE_PRODUCT_COLLECTION_ID || "marketplace_showcases";
const bucketId = process.env.APPWRITE_PRODUCT_BUCKET_ID || "69032c8c002ad7e77e5c";
const businessId = process.env.PANDIT_PRINTING_BUSINESS_ID || "6a5e771161b00abc9be1";
type AppwriteDocument = Record<string, unknown> & { $id: string; $createdAt?: string };
export type Product = { id: string; title: string; description: string; category: string; brand: string; price: number | null; imageUrl: string | null };
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function imageUrl(doc: AppwriteDocument) { const direct = text(doc.mediaUrl); if (direct) return direct; const id = text(doc.mediaId); return id ? `${endpoint}/storage/buckets/${bucketId}/files/${id}/view?project=${projectId}` : null; }
export async function getPublishedProducts(): Promise<Product[]> {
  const url = new URL(`${endpoint}/databases/${databaseId}/collections/${collectionId}/documents`);
  url.searchParams.append("queries[]", JSON.stringify({ method: "equal", attribute: "businessId", values: [businessId] }));
  url.searchParams.append("queries[]", JSON.stringify({ method: "limit", values: [100] }));
  try {
    const response = await fetch(url, { headers: { "X-Appwrite-Project": projectId }, next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`Appwrite returned ${response.status}`);
    const payload = await response.json() as { documents?: AppwriteDocument[] };
    return (payload.documents || []).filter((doc) => doc.isActive !== false && !["draft", "hidden", "inactive"].includes(text(doc.status).toLowerCase())).sort((a, b) => text(b.createdAt || b.$createdAt).localeCompare(text(a.createdAt || a.$createdAt))).map((doc) => ({ id: doc.$id, title: text(doc.title) || "Custom print product", description: text(doc.description), category: text(doc.category), brand: text(doc.brand), price: typeof doc.price === "number" && doc.price > 0 ? doc.price : null, imageUrl: imageUrl(doc) }));
  } catch (error) { console.error("Unable to load Pandit Printing catalogue", error); return []; }
}
