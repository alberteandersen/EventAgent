-- Seed inbox/outreach demo for user 1d65b9a8-6f30-404a-83fc-1d47332fad8a
-- Active event: 469f0a20-94e2-49af-8034-525e7ac59e03 (Poland venues)

-- Idempotent: remove prior demo rows (fixed UUID prefix a100000*)
delete from public.reply_proposals where id::text like 'a10000%';
delete from public.email_attachments where id::text like 'a10000%';
delete from public.email_replies where id::text like 'a10000%';
delete from public.outbound_emails where id::text like 'a10000%';
delete from public.email_drafts where id::text like 'a10000%';

-- Venue contact emails for demo threads
update public.venues set email = 'bryllup@palacbrunow.pl', swipe_status = 'liked'
  where id = '7abc6027-8e40-4432-89be-f10223279307';
update public.venues set email = 'events@raffles.com', swipe_status = 'liked'
  where id = '6ab91b52-a90a-421b-8fd7-0674231ad7c9';
update public.venues set email = 'wesela@palacmalawies.pl', swipe_status = 'liked'
  where id = 'f15e8415-7a5f-48d9-822c-fdf17f47c40f';
update public.venues set email = 'kontakt@palacrozalin.pl', swipe_status = 'liked'
  where id = '7369e396-9bda-4e0d-ba2a-cea6dfed667e';

-- Master draft
insert into public.email_drafts (id, event_id, user_id, subject, body_template, status, version, category)
values (
  'a1000001-0000-4000-8000-000000000001',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'Forespørgsel om bryllup — f & f',
  E'Kære {{venue_name}},\n\nVi planlægger vores bryllup i Polen og er meget interesserede i jeres venue. Vi forventer ca. 80 gæster og leder efter en dato i sensommeren 2027.\n\nKunne I sende os information om kapacitet, priser og tilgængelighed?\n\nMed venlig hilsen\nf & f',
  'sent',
  1,
  'venue'
);

-- Outbound outreach emails
insert into public.outbound_emails (
  id, event_id, venue_id, draft_id, user_id, to_email, subject, body,
  gmail_message_id, gmail_thread_id, status, sent_at, kind
) values
(
  'a1000002-0000-4000-8000-000000000001',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '7abc6027-8e40-4432-89be-f10223279307',
  'a1000001-0000-4000-8000-000000000001',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'bryllup@palacbrunow.pl',
  'Forespørgsel om bryllup — f & f',
  E'Kære Pałac Brunów,\n\nVi planlægger vores bryllup i Polen og er meget interesserede i jeres venue. Vi forventer ca. 80 gæster og leder efter en dato i sensommeren 2027.\n\nKunne I sende os information om kapacitet, priser og tilgængelighed?\n\nMed venlig hilsen\nf & f',
  'seed-msg-brunow-001',
  'seed-thread-brunow',
  'replied',
  '2026-07-10T10:00:00+00:00',
  'outreach'
),
(
  'a1000003-0000-4000-8000-000000000002',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '6ab91b52-a90a-421b-8fd7-0674231ad7c9',
  'a1000001-0000-4000-8000-000000000001',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'events@raffles.com',
  'Forespørgsel om bryllup — f & f',
  E'Kære Raffles Europejski Warsaw,\n\nVi planlægger vores bryllup i Polen og er meget interesserede i jeres venue. Vi forventer ca. 80 gæster og leder efter en dato i sensommeren 2027.\n\nKunne I sende os information om kapacitet, priser og tilgængelighed?\n\nMed venlig hilsen\nf & f',
  'seed-msg-raffles-001',
  'seed-thread-raffles',
  'sent',
  '2026-07-11T14:30:00+00:00',
  'outreach'
),
(
  'a1000004-0000-4000-8000-000000000003',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  'f15e8415-7a5f-48d9-822c-fdf17f47c40f',
  'a1000001-0000-4000-8000-000000000001',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'wesela@palacmalawies.pl',
  'Forespørgsel om bryllup — f & f',
  E'Kære Pałac Mała Wieś,\n\nVi planlægger vores bryllup i Polen og er meget interesserede i jeres venue. Vi forventer ca. 80 gæster og leder efter en dato i sensommeren 2027.\n\nKunne I sende os information om kapacitet, priser og tilgængelighed?\n\nMed venlig hilsen\nf & f',
  'seed-msg-malawies-001',
  'seed-thread-malawies',
  'replied',
  '2026-07-09T09:15:00+00:00',
  'outreach'
),
(
  'a1000005-0000-4000-8000-000000000004',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '7369e396-9bda-4e0d-ba2a-cea6dfed667e',
  'a1000001-0000-4000-8000-000000000001',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'kontakt@palacrozalin.pl',
  'Forespørgsel om bryllup — f & f',
  E'Kære Pałac Rozalin,\n\nVi planlægger vores bryllup i Polen og er meget interesserede i jeres venue. Vi forventer ca. 80 gæster og leder efter en dato i sensommeren 2027.\n\nKunne I sende os information om kapacitet, priser og tilgængelighed?\n\nMed venlig hilsen\nf & f',
  'seed-msg-rozalin-001',
  'seed-thread-rozalin',
  'replied',
  '2026-07-08T11:00:00+00:00',
  'outreach'
);

-- Inbound replies
insert into public.email_replies (
  id, outbound_email_id, venue_id, event_id, user_id,
  gmail_message_id, from_email, snippet, body, received_at,
  quote, quote_status, read_at
) values
(
  'a1000010-0000-4000-8000-000000000001',
  'a1000002-0000-4000-8000-000000000001',
  '7abc6027-8e40-4432-89be-f10223279307',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'seed-reply-brunow-001',
  'bryllup@palacbrunow.pl',
  'Tak for jeres henvendelse — vi har ledige datoer i august 2027.',
  E'Dzień dobry,\n\nDziękujemy za zainteresowanie Pałac Brunów. Mamy wolne terminy 14. i 21. sierpnia 2027 dla ok. 80 gości.\n\nPakiet weekendowy od 185 000 PLN obejmuje salę, noclegi dla 40 osób i podstawową dekorację. Możemy umówić wizytę w sobotę 19 lipca.\n\nPozdrawiamy serdecznie,\nAnna Kowalska\nKoordynator wesel',
  '2026-07-11T08:45:00+00:00',
  '{"has_quote": true, "price_amount": 185000, "currency": "PLN", "price_basis": "total", "availability": "available", "conditions": "Weekendpakke inkl. 40 overnatninger", "summary": "Ledig 14. og 21. august 2027 — weekendpakke fra 185.000 PLN for ~80 gæster."}'::jsonb,
  'quoted',
  null
),
(
  'a1000011-0000-4000-8000-000000000002',
  'a1000004-0000-4000-8000-000000000003',
  'f15e8415-7a5f-48d9-822c-fdf17f47c40f',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'seed-reply-malawies-001',
  'wesela@palacmalawies.pl',
  'Oferujemy pakiet weselny od 142 000 PLN.',
  E'Szanowni Państwo,\n\nDziękujemy za wiadomość. Dla 80 gości proponujemy pakiet od 142 000 PLN (ceremonia w ogrodzie + przyjęcie w pałacu).\n\nW załączeniu przesyłamy menu degustacyjne. Prosimy o informację, czy preferujecie sobotę czy niedzielę.\n\nZ poważaniem,\nMarta Wiśniewska',
  '2026-07-10T16:20:00+00:00',
  '{"has_quote": true, "price_amount": 142000, "currency": "PLN", "price_basis": "total", "availability": "unclear", "conditions": "Ceremonia w ogrodzie + przyjęcie w pałacu", "summary": "Pakiet od 142.000 PLN for 80 gæster — menu vedlagt, afventer foretrukken dag."}'::jsonb,
  'needs_info',
  '2026-07-11T09:00:00+00:00'
),
(
  'a1000012-0000-4000-8000-000000000003',
  'a1000005-0000-4000-8000-000000000004',
  '7369e396-9bda-4e0d-ba2a-cea6dfed667e',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  'seed-reply-rozalin-001',
  'kontakt@palacrozalin.pl',
  'Niestety wybrany termin jest już zarezerwowany.',
  E'Dzień dobry,\n\nDziękujemy za zapytanie. Niestety w sierpniu 2027 mamy już pełne obłożenie. Możemy zaproponować czerwiec 2027 lub wrzesień 2028.\n\nGdyby te terminy były interesujące, chętnie prześlemy wstępną wycenę.\n\nPozdrawiamy,\nZespół Pałac Rozalin',
  '2026-07-09T13:10:00+00:00',
  '{"has_quote": false, "price_amount": null, "currency": null, "price_basis": null, "availability": "unavailable", "conditions": "Alternativ: juni 2027 eller september 2028", "summary": "August 2027 er optaget — tilbyder juni 2027 eller september 2028."}'::jsonb,
  'no_availability',
  '2026-07-09T14:00:00+00:00'
);

-- Juno proposal for Brunów reply (awaiting user approval)
insert into public.reply_proposals (
  id, email_reply_id, outbound_email_id, venue_id, event_id, user_id, body, status
) values (
  'a1000020-0000-4000-8000-000000000001',
  'a1000010-0000-4000-8000-000000000001',
  'a1000002-0000-4000-8000-000000000001',
  '7abc6027-8e40-4432-89be-f10223279307',
  '469f0a20-94e2-49af-8034-525e7ac59e03',
  '1d65b9a8-6f30-404a-83fc-1d47332fad8a',
  E'Dzień dobry pani Anno,\n\nBardzo dziękujemy za szybką odpowiedź i propozycję terminów. 21 sierpnia 2027 brzmi idealnie dla nas.\n\nCzy moglibyśmy umówić wizytę na 19 lipca? Chcielibyśmy też doprecyzować, co dokładnie obejmuje pakiet weekendowy (catering, bar, koordynator).\n\nZ poważaniem,\nJuno, w imieniu f & f',
  'proposed'
);

-- Event status reflects active outreach
update public.events
set status = 'awaiting_replies'
where id = '469f0a20-94e2-49af-8034-525e7ac59e03';
