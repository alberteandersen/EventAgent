/* The default split of a Danish wedding budget: the share each category
   usually takes. Budget proposes it, the estimate and Juno's budget assistant
   start from it, and the couple edits it. */

export type BudgetLine = {
  id: string;
  label: string;
  pct: number;          // share of total
  spent: number;        // DKK committed/paid
  hint: string;
  icon: string;         // BudgetIconId, fixed for standards, pickable for custom
  color: string;        // hex, fixed for standards, pickable for custom
};

export const budgetLines: BudgetLine[] = [
  { id: 'venue',    label: 'Venue',                  pct: 26, spent: 0, hint: '', icon: 'building', color: '#4A5D3A' },
  { id: 'rental',   label: 'Leje & udstyr',          pct:  7, spent: 0, hint: '', icon: 'tent',     color: '#9A8354' },
  { id: 'catering', label: 'Mad & drikke',           pct: 27, spent: 0, hint: '', icon: 'utensils', color: '#C17A4A' },
  { id: 'photo',    label: 'Foto & film',            pct: 11, spent: 0, hint: '', icon: 'camera',   color: '#5A6E7A' },
  { id: 'florals',  label: 'Blomster & dekoration',  pct:  9, spent: 0, hint: '', icon: 'flower',   color: '#A66B7A' },
  { id: 'music',    label: 'Musik & underholdning',  pct:  7, spent: 0, hint: '', icon: 'music',    color: '#8B6B3A' },
  { id: 'attire',   label: 'Tøj & beauty',           pct:  8, spent: 0, hint: '', icon: 'shirt',    color: '#8B5E4A' },
  { id: 'misc',     label: 'Invitationer & andet',   pct:  5, spent: 0, hint: '', icon: 'mail',     color: '#6B7568' },
];
