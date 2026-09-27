import {
  Brain, CalendarHeart, ClipboardList, Flag, Gift, Globe, Heart, ListChecks, Mail, Monitor,
  PenLine, Search, Store, Users, Wallet, Wrench, type LucideIcon,
} from 'lucide-react';

/* What each of Ava's tools is called in the chat. The label is Danish source
   text for t(); `detail` picks the one argument worth showing next to it, so
   "Søgte efter leverandører · fotograf" says more than the tool name alone. */

interface ToolLabel {
  label: string;
  icon: LucideIcon;
  detail?: (args: Record<string, unknown>) => string | undefined;
}

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const count = (v: unknown): string | undefined =>
  Array.isArray(v) && v.length > 0 ? String(v.length) : undefined;

export const TOOL_LABELS: Record<string, ToolLabel> = {
  show_page:             { label: 'Viste en side', icon: Monitor, detail: (a) => text(a.page) },
  update_event_details:  { label: 'Opdaterede bryllupsdetaljer', icon: CalendarHeart },
  search_venues:         { label: 'Søgte efter leverandører', icon: Search, detail: (a) => text(a.category) ?? text(a.location) },
  mark_venue_chosen:     { label: 'Valgte lokalet', icon: Heart },
  find_venue_email:      { label: 'Fandt kontaktmail', icon: Mail, detail: (a) => text(a.venue_name) },
  draft_invite_text:     { label: 'Skrev invitationstekst', icon: PenLine },
  propose_email_draft:   { label: 'Skrev udkast til mail', icon: Mail },
  mark_vendor_booked:    { label: 'Markerede leverandør som booket', icon: Store },
  mark_stage_complete:   { label: 'Opdaterede jeres forløb', icon: Flag, detail: (a) => text(a.stage) },
  propose_vendor_reply:  { label: 'Skrev svar til leverandør', icon: Mail },
  update_website_design: { label: 'Designede hjemmesiden', icon: Globe },
  get_website:           { label: 'Kiggede på hjemmesiden', icon: Globe },
  update_website_content: { label: 'Rettede teksten på hjemmesiden', icon: PenLine },
  use_website_version:   { label: 'Skiftede version af hjemmesiden', icon: Globe },
  get_planning_overview: { label: 'Tjekkede planlægningen', icon: ClipboardList },
  list_vendors:          { label: 'Så leverandørerne igennem', icon: Store, detail: (a) => text(a.category) },
  swipe_vendor:          { label: 'Sorterede en leverandør', icon: Store },
  list_budget:           { label: 'Læste budgettet', icon: Wallet },
  set_budget_entry:      { label: 'Opdaterede budgettet', icon: Wallet, detail: (a) => text(a.label) ?? text(a.category) },
  delete_budget_entry:   { label: 'Slettede en budgetpost', icon: Wallet, detail: (a) => text(a.category) },
  list_guests:           { label: 'Læste gæstelisten', icon: Users },
  add_guests:            { label: 'Tilføjede gæster', icon: Users, detail: (a) => count(a.guests) },
  update_guest:          { label: 'Opdaterede en gæst', icon: Users, detail: (a) => text(a.name) },
  remove_guest:          { label: 'Fjernede en gæst', icon: Users, detail: (a) => text(a.name) },
  list_tasks:            { label: 'Læste opgaverne', icon: ListChecks },
  add_tasks:             { label: 'Tilføjede opgaver', icon: ListChecks, detail: (a) => count(a.tasks) },
  update_task:           { label: 'Opdaterede en opgave', icon: ListChecks, detail: (a) => text(a.title) ?? text(a.new_title) },
  delete_task:           { label: 'Slettede en opgave', icon: ListChecks, detail: (a) => text(a.title) },
  list_registry:         { label: 'Læste ønskelisten', icon: Gift },
  add_registry_items:    { label: 'Tilføjede ønsker', icon: Gift, detail: (a) => count(a.items) },
  update_registry_item:  { label: 'Opdaterede et ønske', icon: Gift },
  delete_registry_item:  { label: 'Slettede et ønske', icon: Gift },
  remember:              { label: 'Huskede', icon: Brain, detail: (a) => text(a.content) },
  forget:                { label: 'Glemte en note', icon: Brain },
};

/** Label, icon and detail for a tool, with a readable fallback for new ones. */
export function toolLabel(name: string, args: Record<string, unknown>) {
  const known = TOOL_LABELS[name];
  if (!known) return { label: name.replace(/_/g, ' '), icon: Wrench, detail: undefined, known: false };
  return { label: known.label, icon: known.icon, detail: known.detail?.(args), known: true };
}
