import { Type, type FunctionDeclaration } from "@google/genai";
import { AGENT_PAGES } from "@/lib/db/types";
import { planningFunctionDeclarations } from "./planningTools";
import { memoryFunctionDeclarations } from "./memory";
import { websiteFunctionDeclarations } from "./websiteTools";

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "show_page",
    description:
      "Open one of the app's pages on the user's screen so they see what you're talking about or what you just changed. Pages: home (dashboard), vendors (venue & vendor board), inbox (vendor replies & quotes), planning (timeline tasks), budget, guests (guest list & RSVP), website (wedding website builder), registry (gift wishlist), invites (invitations), seating (table plan). For vendors you can deep-link with vendor_category and hub_tab.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        page: {
          type: Type.STRING,
          enum: [...AGENT_PAGES],
        },
        vendor_category: {
          type: Type.STRING,
          enum: ["venue", "florist", "photographer", "musician", "caterer", "planner", "other"],
          description: "Which vendor category to focus when page is vendors",
        },
        hub_tab: {
          type: Type.STRING,
          enum: ["explore", "shortlist", "booked"],
          description: "Which vendor-board tab to open when page is vendors",
        },
      },
      required: ["page"],
    },
  },
  {
    name: "update_event_details",
    description:
      "Save wedding details the user has revealed. Call whenever new facts appear. Only pass fields you learned; omit unknown ones.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Short wedding title, e.g. \"Emma & James's Wedding\"" },
        event_type: { type: Type.STRING, description: "e.g. full wedding, ceremony only, elopement, reception" },
        location: { type: Type.STRING, description: "City or area, e.g. Copenhagen" },
        guest_count: { type: Type.INTEGER },
        event_date: { type: Type.STRING, description: "ISO date YYYY-MM-DD if a firm date is set" },
        date_hint: { type: Type.STRING, description: "Rough timing when no firm date, e.g. 'Summer 2027'" },
        budget: { type: Type.STRING, description: "Free-form budget, e.g. 'around 50k DKK'" },
        requirements: {
          type: Type.OBJECT,
          description: "Any other requirements as key/value, e.g. {\"catering\": \"vegetarian options\"}",
          properties: {},
        },
      },
    },
  },
  {
    name: "search_venues",
    description:
      "Research real wedding venues or local vendors on the internet, verified against Google Places (ratings, reviews, photos, contact info). Creates swipeable cards for the user. Venues require location and guest count. Non-venue categories (florist, photographer, musician, caterer) should only be searched once the venue or at least the location is settled, vendors are local to it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Search intent including any special requirements, e.g. 'garden wedding venue with outdoor ceremony space'",
        },
        location: { type: Type.STRING },
        guest_count: { type: Type.INTEGER },
        category: {
          type: Type.STRING,
          enum: ["venue", "florist", "photographer", "musician", "caterer", "planner", "other"],
          description: "What to search for. Defaults to venue.",
        },
      },
      required: ["query", "location"],
    },
  },
  {
    name: "mark_venue_chosen",
    description:
      "Record that the couple has decided on their wedding venue. Call when the user clearly commits to one venue ('we're going with X'). Unlocks the vendors and invites stages. Pass the venue id from the board; if they booked a venue outside the app, omit venue_id and set booked_externally instead.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        venue_id: { type: Type.STRING, description: "Id of the chosen venue on the board" },
        booked_externally: {
          type: Type.BOOLEAN,
          description: "True when the venue was booked outside the app",
        },
      },
    },
  },
  {
    name: "find_venue_email",
    description:
      "Find the booking/contact email address for one liked venue that is missing an email. Pass the venue id from the search results.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        venue_id: { type: Type.STRING },
        venue_name: { type: Type.STRING },
        website: { type: Type.STRING },
      },
      required: ["venue_id", "venue_name"],
    },
  },
  {
    name: "draft_invite_text",
    description:
      "Write the wording on the couple's printed invitation card (the Invitationer page), where it replaces the design's own lines. The card already states the facts (names, date, time, place, RSVP date): never repeat them here. Give only the lines you are changing. Write in the couple's language, warm and correct stationery phrasing; keep each line short, it has to fit a card.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eyebrow: {
          type: Type.STRING,
          description: "The small line above the names, e.g. 'Sammen med vores familier'",
        },
        invite: {
          type: Type.STRING,
          description: "The line after the names that invites the guest, e.g. 'inviterer jer til vores bryllup'",
        },
        closing: {
          type: Type.STRING,
          description: "The warm sign-off at the bottom, e.g. 'Vi glæder os til at fejre dagen med jer'. Promise nothing the facts don't say.",
        },
        note: {
          type: Type.STRING,
          description: "Optional practical line for guests: dresscode, a line about the party",
        },
      },
    },
  },
  {
    name: "propose_email_draft",
    description:
      "Propose the master outreach email for one category of liked vendors. Ava composes an individual email per recipient from this brief and sends them from the Kalas mailbox after the user approves. The body MUST contain the {{venue_name}} placeholder. Set category to match which liked vendors this goes to (venue, florist, photographer, musician, caterer).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        body_template: {
          type: Type.STRING,
          description: "Plain-text email body containing {{venue_name}}",
        },
        category: {
          type: Type.STRING,
          enum: ["venue", "florist", "photographer", "musician", "caterer", "planner", "other"],
          description: "Which liked vendor category this outreach targets. Defaults to venue.",
        },
      },
      required: ["subject", "body_template"],
    },
  },
  {
    name: "mark_vendor_booked",
    description:
      "Record that the couple has booked a vendor (florist, photographer, etc.) or venue. Call when the user confirms they've committed to one. Pass the venue/vendor id from the board.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        venue_id: { type: Type.STRING },
      },
      required: ["venue_id"],
    },
  },
  {
    name: "mark_stage_complete",
    description:
      "Manually mark a whole journey stage complete when the user says they've finished it their own way (e.g. booked a venue or vendors outside the app, or finished with invites). Use sparingly, prefer mark_venue_chosen / mark_vendor_booked for specific items.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        stage: {
          type: Type.STRING,
          enum: ["venue", "vendors", "invites"],
        },
      },
      required: ["stage"],
    },
  },
  {
    name: "propose_vendor_reply",
    description:
      "Draft a revised reply to a vendor the user is discussing with you. Use when the user wants to change how you respond to a specific vendor reply. The user reviews and approves it before it sends. Pass the reply_id being discussed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reply_id: { type: Type.STRING },
        body: {
          type: Type.STRING,
          description: "The full revised email body to send back to the vendor",
        },
      },
      required: ["reply_id", "body"],
    },
  },
  {
    name: "update_website_design",
    description:
      "Design or restyle the couple's wedding website. Use when they ask you to design their site, or to change how it looks (colors, fonts, layout, mood, e.g. 'gør hjemmesiden mørkere', 'større forsidebillede'). Pass their request as the instruction; set regenerate=true only when they want a completely fresh design instead of an adjustment. Every change is saved as a new version; use_website_version goes back. For what the site says (texts, sections, programme, FAQ) use update_website_content instead.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: {
          type: Type.STRING,
          description: "The couple's styling wish, in their own words",
        },
        regenerate: {
          type: Type.BOOLEAN,
          description: "true = design from scratch; false/omitted = adjust the current design",
        },
      },
      required: ["instruction"],
    },
  },
  ...planningFunctionDeclarations,
  ...memoryFunctionDeclarations,
  ...websiteFunctionDeclarations,
];
