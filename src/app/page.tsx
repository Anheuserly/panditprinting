import { ArrowRight, BadgeCheck, Boxes, Clock3, Mail, MapPin, PackageCheck, Phone, Printer, Quote, Scissors, Sparkles } from "lucide-react";
import { getPublishedProducts } from "@/lib/catalog";

export const revalidate = 60;
const phone = "+91 87449 79804";
const whatsapp = "https://wa.me/918744979804?text=Hello%20Pandit%20Printing%20Press%2C%20I%20would%20like%20a%20printing%20quote.";
const capabilities = [
  { icon: Printer, title: "Commercial printing", text: "Brochures, catalogues, business stationery, forms, and everyday office print." },
  { icon: Sparkles, title: "Invitations & cards", text: "Wedding invitations, event cards, envelopes, and coordinated finishing." },
  { icon: Boxes, title: "Labels & packaging", text: "Product labels, sleeves, cartons, stickers, and short-run packaging." },
  { icon: Scissors, title: "Custom finishing", text: "Lamination, binding, cutting, creasing, foiling, and presentation-ready assembly." },
];

export default async function Home() {
  const products = await getPublishedProducts();
  return <main>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Pandit Printing Press home"><span className="brand-mark">PP</span><span><strong>Pandit Printing Press</strong><small>S N Enterprises</small></span></a>
      <nav aria-label="Primary navigation"><a href="#products">Products</a><a href="#capabilities">Capabilities</a><a href="#process">Process</a><a href="#contact">Contact</a></nav>
      <a className="header-call" href="tel:+918744979804"><Phone size={17} /> Call us</a>
    </header>
    <section className="hero" id="top"><div className="hero-shade" /><div className="hero-content">
      <p className="eyebrow">PRINTED IN DELHI · DELIVERED WITH CARE</p><h1>Pandit Printing Press</h1>
      <p className="hero-copy">Reliable commercial printing, invitations, labels, packaging, and custom finishing for businesses and families.</p>
      <div className="hero-actions"><a className="button button-primary" href="#products">Browse products <ArrowRight size={18} /></a><a className="button button-quiet" href={whatsapp} target="_blank" rel="noreferrer">Request a quote</a></div>
      <div className="hero-facts"><span><BadgeCheck size={17} /> Business-ready quality</span><span><Clock3 size={17} /> Clear turnaround times</span><span><PackageCheck size={17} /> Checked before dispatch</span></div>
    </div></section>
    <section className="trust-strip"><p><strong>S N Enterprises</strong><span>Design, print, finish, and delivery from one dependable team.</span></p><a href={whatsapp} target="_blank" rel="noreferrer">Discuss your requirement <ArrowRight size={17} /></a></section>
    <section className="section products-section" id="products"><div className="section-heading"><div><p className="eyebrow dark">LIVE CATALOGUE</p><h2>Products from our press</h2><p>Current public listings managed by S N Enterprises.</p></div><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Ask for a custom size <ArrowRight size={17} /></a></div>
      {products.length ? <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-media">{product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" /> : <Printer size={38} />}</div><div className="product-body"><div className="product-meta"><span>{product.category || "Custom print"}</span>{product.brand && <span>{product.brand}</span>}</div><h3>{product.title}</h3><p>{product.description || "Contact us for paper, size, finish, and quantity options."}</p><div className="product-footer"><strong>{product.price ? `From ₹${product.price.toLocaleString("en-IN")}` : "Quote on request"}</strong><a href={`${whatsapp}%20I%20am%20interested%20in%20${encodeURIComponent(product.title)}.`} target="_blank" rel="noreferrer"><Quote size={17} /> Quote</a></div></div></article>)}</div> : <div className="catalogue-empty"><Printer size={34} /><div><h3>Our online catalogue is being prepared.</h3><p>Tell us what you need and we will share suitable paper, finishing, quantity, and pricing options directly.</p></div><a className="button button-dark" href={whatsapp} target="_blank" rel="noreferrer">Get a quote <ArrowRight size={18} /></a></div>}
    </section>
    <section className="section capabilities" id="capabilities"><div className="section-heading"><div><p className="eyebrow dark">WHAT WE MAKE</p><h2>Practical print, properly finished</h2><p>One team from artwork review to final packing.</p></div></div><div className="capability-grid">{capabilities.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="process-band" id="process"><div className="section process-inner"><div><p className="eyebrow">A CLEAR PROCESS</p><h2>From requirement to finished print</h2></div><ol><li><span>01</span><strong>Share details</strong><p>Size, quantity, artwork, finish, and delivery date.</p></li><li><span>02</span><strong>Approve proof</strong><p>We confirm specifications and artwork before production.</p></li><li><span>03</span><strong>Print & finish</strong><p>Your order is produced, finished, and quality checked.</p></li><li><span>04</span><strong>Collect or deliver</strong><p>Receive a packed order ready for use.</p></li></ol></div></section>
    <section className="section contact" id="contact"><div><p className="eyebrow dark">START A PRINT JOB</p><h2>Tell us what you need.</h2><p>Send the artwork, quantity, size, and expected date. We will reply with the right production option.</p></div><div className="contact-details"><a href="tel:+918744979804"><Phone /><span><small>Call or WhatsApp</small>{phone}</span></a><a href="mailto:shivnarayandelhi91@gmail.com"><Mail /><span><small>Email</small>shivnarayandelhi91@gmail.com</span></a><p><MapPin /><span><small>Service area</small>Delhi and nearby regions</span></p></div><a className="button button-dark" href={whatsapp} target="_blank" rel="noreferrer">Request a quote <ArrowRight size={18} /></a></section>
    <footer><div className="brand footer-brand"><span className="brand-mark">PP</span><span><strong>Pandit Printing Press</strong><small>S N Enterprises</small></span></div><p>Commercial printing and custom print production in Delhi.</p><p>© {new Date().getFullYear()} S N Enterprises</p></footer>
  </main>;
}
