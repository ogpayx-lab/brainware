// ─── Help Articles Database ───
// All help content for BrainWare, organized by category and role

export interface HelpArticle {
  id: string
  category: string
  categoryIcon: string
  title: string
  summary: string
  steps: string[]
  tips?: string[]
  role: 'employee' | 'owner' | 'both'
}

export const HELP_CATEGORIES = [
  { key: 'getting_started', label: 'Primi Passi', icon: '🚀' },
  { key: 'pos', label: 'POS & Vendite', icon: '💰' },
  { key: 'shifts', label: 'Turni', icon: '⏰' },
  { key: 'inventory', label: 'Inventario', icon: '📦' },
  { key: 'fidelity', label: 'Fidelity Card', icon: '💳' },
  { key: 'tasks', label: 'Task & Manutenzione', icon: '📋' },
  { key: 'photos', label: 'Foto Registro', icon: '📸' },
  { key: 'dashboard', label: 'Dashboard Owner', icon: '📊' },
  { key: 'warehouse', label: 'Magazzino', icon: '🏭' },
  { key: 'team', label: 'Team & Dipendenti', icon: '👥' },
  { key: 'system_log', label: 'System Log', icon: '🗄️' },
  { key: 'notifications', label: 'Notifiche', icon: '🔔' },
]

export const HELP_ARTICLES: HelpArticle[] = [
  // ── PRIMI PASSI ──
  {
    id: 'gs-1', category: 'getting_started', categoryIcon: '🚀',
    title: 'Primo accesso al sistema',
    summary: 'Come effettuare il login e accedere per la prima volta alla piattaforma.',
    role: 'both',
    steps: [
      'Vai alla pagina di login inserendo l\'indirizzo fornito dal tuo responsabile.',
      'Inserisci l\'email e la password che ti sono state assegnate.',
      'Clicca "Accedi" — verrai reindirizzato alla tua dashboard.',
      'Se sei un dipendente, vedrai la schermata di apertura turno.',
      'Se sei un owner, vedrai la dashboard con i KPI del giorno.',
    ],
    tips: [
      'Se dimentichi la password, contatta il tuo owner per il reset.',
      'Il sistema riconosce automaticamente il tuo ruolo (dipendente o owner).',
    ],
  },
  {
    id: 'gs-2', category: 'getting_started', categoryIcon: '🚀',
    title: 'Panoramica dell\'interfaccia dipendente',
    summary: 'Capire la struttura della dashboard dipendente e come navigare.',
    role: 'employee',
    steps: [
      'La dashboard mostra le azioni rapide in alto: POS, Foto, Inventario, etc.',
      'Sotto trovi le statistiche del turno corrente: vendite, incasso, task.',
      'In basso c\'è la barra di navigazione per passare tra le sezioni.',
      'L\'icona 🤖 apre l\'assistente AI per domande rapide.',
    ],
    tips: [
      'Devi sempre avere un turno aperto per poter usare il POS.',
      'Le notifiche arrivano in tempo reale al tuo owner.',
    ],
  },

  // ── POS & VENDITE ──
  {
    id: 'pos-1', category: 'pos', categoryIcon: '💰',
    title: 'Come registrare una vendita',
    summary: 'Guida passo-passo per completare una vendita nel POS.',
    role: 'employee',
    steps: [
      'Dalla dashboard, tocca "POS" o l\'icona 💰.',
      'Seleziona i prodotti dalla lista — usa la barra di ricerca per trovarli velocemente.',
      'Imposta la quantità per ogni prodotto (in grammi o unità).',
      'I prodotti selezionati appariranno nel carrello a destra.',
      'Compila il nome del cliente (obbligatorio) e la nazionalità.',
      'Seleziona il metodo di pagamento: Cash o POS.',
      'Se c\'è un codice promo, inseriscilo nell\'apposito campo.',
      'Clicca "Completa Vendita" per finalizzare.',
    ],
    tips: [
      'L\'importo si aggiorna in tempo reale nel carrello.',
      'Puoi rimuovere un prodotto dal carrello cliccando la ✗.',
      'Il sistema notifica automaticamente l\'owner per ogni vendita.',
      'Per vendite online, seleziona il canale "Online" nel tipo di acquisizione.',
    ],
  },
  {
    id: 'pos-2', category: 'pos', categoryIcon: '💰',
    title: 'Come applicare un codice promo',
    summary: 'Procedura per applicare sconti e codici promozionali.',
    role: 'employee',
    steps: [
      'Nella schermata POS, dopo aver aggiunto i prodotti al carrello.',
      'Trova il campo "Codice Promo" sotto i dettagli cliente.',
      'Inserisci il codice e premi Invio o il pulsante di verifica.',
      'Se valido, lo sconto verrà applicato automaticamente al totale.',
      'Completa la vendita normalmente.',
    ],
    tips: [
      'I codici promo sono creati dall\'owner nella sezione "Codici Promo".',
      'Ogni codice ha un numero massimo di utilizzi.',
      'Se il codice non funziona, contatta il tuo owner.',
    ],
  },
  {
    id: 'pos-3', category: 'pos', categoryIcon: '💰',
    title: 'Consultare il registro vendite',
    summary: 'Come l\'owner può visualizzare, filtrare ed esportare tutte le vendite.',
    role: 'owner',
    steps: [
      'Dalla sidebar, clicca "Registro Vendite".',
      'Usa i filtri in alto per selezionare: negozio, data inizio, data fine.',
      'La tabella mostra: data, ora, prodotto, prezzo, qty, pagamento, cliente, dipendente.',
      'Vendite dello stesso cliente/transazione sono raggruppate con lo stesso colore.',
      'Clicca "📥 Esporta Excel" per scaricare il registro in formato CSV.',
    ],
    tips: [
      'Puoi ordinare le colonne cliccando sull\'intestazione.',
      'Il formato CSV si apre direttamente in Excel.',
    ],
  },

  // ── TURNI ──
  {
    id: 'shift-1', category: 'shifts', categoryIcon: '⏰',
    title: 'Come aprire un turno',
    summary: 'Procedura per iniziare il turno di lavoro.',
    role: 'employee',
    steps: [
      'Al login, se non hai un turno aperto, vedrai automaticamente la schermata di apertura.',
      'Seleziona il periodo: ☀️ Mattina o 🌙 Sera.',
      'Inserisci il fondo cassa iniziale (importo contante nel registratore).',
      'Clicca "Apri Turno".',
      'Verrai reindirizzato alla dashboard con il turno attivo.',
    ],
    tips: [
      'Il fondo cassa è importante per il calcolo della quadratura a fine turno.',
      'Non puoi avere due turni aperti contemporaneamente.',
    ],
  },
  {
    id: 'shift-2', category: 'shifts', categoryIcon: '⏰',
    title: 'Come chiudere un turno',
    summary: 'Procedura per terminare il turno e registrare il deposito.',
    role: 'employee',
    steps: [
      'Dalla dashboard, tocca "Chiudi Turno" nella barra superiore.',
      'Vedrai un riepilogo: vendite totali, incasso cash, incasso POS.',
      'Inserisci l\'importo del deposito effettivo (contante che consegni).',
      'Clicca "Chiudi Turno" per confermare.',
      'Il sistema calcola automaticamente eventuali differenze.',
    ],
    tips: [
      'Assicurati di aver completato tutte le vendite prima di chiudere.',
      'L\'owner viene notificato automaticamente della chiusura.',
    ],
  },
  {
    id: 'shift-3', category: 'shifts', categoryIcon: '⏰',
    title: 'Force checkout di un dipendente',
    summary: 'Come l\'owner può chiudere forzatamente un turno rimasto aperto.',
    role: 'owner',
    steps: [
      'Vai in "Team Performance" dalla sidebar.',
      'Nella sezione "Dipendenti in Turno" vedrai i turni attualmente aperti.',
      'Identifica il turno da chiudere — vedrai data, ora e durata.',
      'Clicca "⚡ Force Checkout" accanto al turno.',
      'Conferma l\'operazione nel popup.',
    ],
    tips: [
      'Usa questa funzione per turni dimenticati aperti (es. 24h+).',
      'Il deposito verrà registrato come 0 — puoi modificarlo dal System Log.',
    ],
  },

  // ── INVENTARIO ──
  {
    id: 'inv-1', category: 'inventory', categoryIcon: '📦',
    title: 'Come fare il conteggio inventario',
    summary: 'Guida al processo di conteggio dei prodotti in negozio.',
    role: 'employee',
    steps: [
      'Dalla dashboard, tocca "Inventario".',
      'Step 1 — Seleziona: scegli i prodotti da contare.',
      'Step 2 — Conta: inserisci la quantità effettiva per ogni prodotto.',
      'Step 3 — Revisione: controlla le differenze tra quantità attesa e contata.',
      'Conferma il conteggio — l\'owner riceverà una notifica automatica.',
    ],
    tips: [
      'Le differenze significative generano un alert per l\'owner.',
      'Conta con attenzione — il conteggio non si può annullare.',
    ],
  },
  {
    id: 'inv-2', category: 'inventory', categoryIcon: '📦',
    title: 'Audit inventario',
    summary: 'Come l\'owner può verificare e confrontare i conteggi.',
    role: 'owner',
    steps: [
      'Dalla sidebar, clicca "Audit Inventario".',
      'Seleziona il negozio e il periodo da analizzare.',
      'Vedrai la lista dei conteggi effettuati con le differenze.',
      'Le discrepanze sono evidenziate in rosso.',
      'Puoi esportare il report per analisi approfondite.',
    ],
  },

  // ── FIDELITY ──
  {
    id: 'fid-1', category: 'fidelity', categoryIcon: '💳',
    title: 'Come creare una fidelity card',
    summary: 'Registrare un nuovo cliente nel programma fedeltà.',
    role: 'employee',
    steps: [
      'Durante una vendita nel POS, troverai l\'opzione "Nuova Fidelity".',
      'Oppure vai nella sezione "Fidelity" dalla dashboard.',
      'Inserisci: nome cliente, telefono, email (opzionale).',
      'Il numero card viene generato automaticamente.',
      'Comunica il numero al cliente — potrà usarlo per accumulare punti.',
    ],
    tips: [
      'I punti vengono assegnati automaticamente ad ogni acquisto.',
      'L\'owner definisce il rapporto punti/euro nelle impostazioni.',
    ],
  },

  // ── TASK & MANUTENZIONE ──
  {
    id: 'task-1', category: 'tasks', categoryIcon: '📋',
    title: 'Come completare un task assegnato',
    summary: 'Gestire i task assegnati dal tuo owner.',
    role: 'employee',
    steps: [
      'Dalla dashboard vedrai i task pendenti nella sezione "I tuoi Task".',
      'Tocca un task per vedere i dettagli.',
      'Completa l\'attività richiesta.',
      'Segna il task come completato con il pulsante ✓.',
      'L\'owner riceverà una notifica di completamento.',
    ],
  },
  {
    id: 'task-2', category: 'tasks', categoryIcon: '📋',
    title: 'Come assegnare task ai dipendenti',
    summary: 'Creare e monitorare task per il team.',
    role: 'owner',
    steps: [
      'Dalla sidebar, clicca "Task".',
      'Clicca "Nuovo Task" in alto a destra.',
      'Compila: descrizione, priorità, scadenza, dipendente assegnato.',
      'Il dipendente riceverà una notifica immediata.',
      'Monitora lo stato dei task dalla stessa pagina.',
    ],
  },

  // ── FOTO REGISTRO ──
  {
    id: 'photo-1', category: 'photos', categoryIcon: '📸',
    title: 'Come caricare una foto del registro',
    summary: 'Scattare e caricare foto del registro cartaceo.',
    role: 'employee',
    steps: [
      'Dalla dashboard, tocca "Foto Registro" o l\'icona 📸.',
      'Tocca l\'area di upload per aprire la fotocamera.',
      'Scatta la foto del registro cartaceo — assicurati che sia leggibile.',
      'Aggiungi una didascalia opzionale (es. "Registro pomeriggio").',
      'Tocca "Carica Foto" per salvare.',
    ],
    tips: [
      'Ogni foto è associata al tuo turno corrente.',
      'L\'owner può vedere tutte le foto nella sezione "Foto Registro" della sua dashboard.',
    ],
  },

  // ── DASHBOARD OWNER ──
  {
    id: 'dash-1', category: 'dashboard', categoryIcon: '📊',
    title: 'Leggere la dashboard',
    summary: 'Capire i KPI e le metriche della dashboard owner.',
    role: 'owner',
    steps: [
      'La dashboard mostra i dati del giorno selezionato (default: oggi).',
      'KPI principali: Incasso totale, Cash, POS, N° transazioni, Media vendita.',
      'Seleziona un negozio specifico o "Tutti" per dati aggregati.',
      'Cambia il range date per analisi su periodi più lunghi.',
      'Le notifiche recenti appaiono in basso — cliccale per navigare alla sezione.',
    ],
    tips: [
      'I dati si aggiornano in tempo reale quando un dipendente registra una vendita.',
      'Il confronto con il giorno/periodo precedente mostra il trend.',
    ],
  },

  // ── MAGAZZINO ──
  {
    id: 'wh-1', category: 'warehouse', categoryIcon: '🏭',
    title: 'Gestione magazzino centrale',
    summary: 'Come gestire lo stock del magazzino centrale.',
    role: 'owner',
    steps: [
      'Dalla sidebar, vai in Magazzino → Centrale.',
      'Vedrai tutti i prodotti con le quantità disponibili.',
      'Per aggiungere stock: clicca "Carico" accanto al prodotto.',
      'Per trasferire a un negozio: clicca "Trasferisci" e seleziona la destinazione.',
      'I movimenti vengono registrati automaticamente nello storico.',
    ],
  },
  {
    id: 'wh-2', category: 'warehouse', categoryIcon: '🏭',
    title: 'Richiesta ricarica stock',
    summary: 'Come un dipendente può richiedere prodotti dal magazzino.',
    role: 'employee',
    steps: [
      'Dalla dashboard, tocca "Ricarica Stock".',
      'Seleziona i prodotti che servono e le quantità richieste.',
      'Aggiungi note se necessario.',
      'Invia la richiesta — l\'owner riceverà una notifica.',
      'L\'owner approverà o rifiuterà la richiesta.',
    ],
  },

  // ── TEAM ──
  {
    id: 'team-1', category: 'team', categoryIcon: '👥',
    title: 'Monitorare le performance del team',
    summary: 'Come analizzare le prestazioni dei dipendenti.',
    role: 'owner',
    steps: [
      'Dalla sidebar, vai in "Team Performance".',
      'Vedrai i dipendenti attualmente in turno con orario e durata.',
      'La tabella mostra le metriche per dipendente: vendite, totale, media.',
      'Puoi usare il "Force Checkout" per turni dimenticati.',
      'Esporta i dati per analisi approfondite.',
    ],
  },

  // ── SYSTEM LOG ──
  {
    id: 'log-1', category: 'system_log', categoryIcon: '🗄️',
    title: 'Come usare il System Log',
    summary: 'Visualizzare e modificare i dati grezzi del sistema.',
    role: 'owner',
    steps: [
      'Dalla sidebar, vai in "System Log" nella sezione Gestione.',
      'Le tab in alto corrispondono alle diverse tabelle: Vendite, Turni, Spese, etc.',
      'Usa i filtri per selezionare negozio e periodo.',
      'Le celle con ✎ sono modificabili: clicca per editare.',
      'Premi Enter per salvare, Escape per annullare.',
      'La ✗ a destra elimina una riga (con conferma).',
      'Usa "📥 CSV" per esportare i dati della tab corrente.',
    ],
    tips: [
      'Tutte le modifiche sono immediate e si riflettono nella dashboard.',
      'Usa il System Log per correggere errori dei dipendenti.',
      'La tab "Prodotti Venduti" mostra il dettaglio di ogni singolo articolo venduto.',
    ],
  },

  // ── NOTIFICHE ──
  {
    id: 'notif-1', category: 'notifications', categoryIcon: '🔔',
    title: 'Come funzionano le notifiche',
    summary: 'Capire il sistema di notifiche in tempo reale.',
    role: 'owner',
    steps: [
      'Le notifiche arrivano automaticamente per ogni azione dei dipendenti.',
      'Nella dashboard, le vedi nel riquadro "Notifiche Recenti".',
      'Clicca su una notifica per andare direttamente alla sezione di riferimento.',
      'La freccia › indica che la notifica è navigabile.',
      'Per vedere tutte le notifiche, vai in "Centro Notifiche" dalla sidebar o dall\'icona 🔔.',
    ],
    tips: [
      'Le notifiche non lette hanno uno sfondo evidenziato.',
      'Tipi: vendita, turno aperto/chiuso, richiesta stock, foto, task completato, etc.',
    ],
  },
]

// ── Contextual tips per pagina ──
export const PAGE_TIPS: Record<string, { title: string; tips: string[] }> = {
  '/employee/dashboard': {
    title: 'Dashboard Dipendente',
    tips: [
      'Le azioni rapide in alto ti portano alle funzioni principali.',
      'Il riepilogo mostra le tue vendite del turno corrente.',
      'Ricorda di chiudere il turno a fine giornata!',
    ],
  },
  '/employee/pos': {
    title: 'POS — Registra Vendita',
    tips: [
      'Cerca i prodotti per nome nella barra di ricerca.',
      'Il carrello a destra mostra il riepilogo della vendita.',
      'Nome cliente e metodo di pagamento sono obbligatori.',
      'Un codice promo si applica prima di completare la vendita.',
    ],
  },
  '/employee/shift/open': {
    title: 'Apertura Turno',
    tips: [
      'Seleziona il periodo corretto: Mattina o Sera.',
      'Il fondo cassa è l\'importo contante nel registratore all\'inizio.',
      'Non puoi usare il POS senza un turno aperto.',
    ],
  },
  '/employee/photos': {
    title: 'Foto Registro',
    tips: [
      'Scatta la foto in buona luce e assicurati sia leggibile.',
      'Aggiungi una didascalia per identificare facilmente la foto.',
      'Le foto vengono inviate automaticamente all\'owner.',
    ],
  },
  '/owner/dashboard': {
    title: 'Dashboard Owner',
    tips: [
      'Seleziona "Tutti" per i dati aggregati di tutti i negozi.',
      'Cambia le date per analisi su periodi diversi.',
      'Clicca sulle notifiche per andare alla sezione relativa.',
    ],
  },
  '/owner/sales-log': {
    title: 'Registro Vendite',
    tips: [
      'Le righe con lo stesso colore appartengono alla stessa transazione.',
      'Usa il filtro date per analisi su periodi specifici.',
      '"Esporta Excel" scarica il CSV apribile in Excel.',
    ],
  },
  '/owner/system-log': {
    title: 'System Log',
    tips: [
      'Le celle con ✎ sono cliccabili e modificabili.',
      'Enter salva, Escape annulla la modifica.',
      'Le modifiche si riflettono immediatamente nella dashboard.',
      'Esporta CSV per backup o analisi esterne.',
    ],
  },
  '/owner/analytics/performance': {
    title: 'Team Performance',
    tips: [
      '"Force Checkout" chiude turni dimenticati aperti.',
      'Verifica periodicamente che non ci siano turni aperti da troppo tempo.',
    ],
  },
  '/owner/products': {
    title: 'Gestione Prodotti',
    tips: [
      'I prezzi aggiornati qui si riflettono immediatamente nel POS.',
      'Usa le categorie per filtrare rapidamente.',
    ],
  },
}
