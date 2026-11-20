// Contact details shown on the public landing page.
export const CONTACT = {
  whatsappNumber: "923018407613",
  whatsappDisplay: "+92 301 8407613",
  email: "developerssden@gmail.com",
  founderName: "Muhammad Abu Bakar",
  founderLinkedIn: "https://www.linkedin.com/in/its-bakar/",
  callbackWindow: "24 hours",
} as const;

export const WHATSAPP_URL = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(
  "Hi, I'd like to register my gym on Kettlio."
)}`;

export const LANDING_NAV = [
  { name: "Features", href: "/#features" },
  { name: "How it works", href: "/#how" },
  { name: "FAQ", href: "/#faq" },
] as const;
