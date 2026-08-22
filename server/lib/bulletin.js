const PDFDocument = require("pdfkit");
const { query } = require("../db/pool");
const { moyenneEleve, classement, classStats, rangMatiere } = require("./calculs");
const { getMention } = require("./reference");
const { getMatieresFor } = require("./matieres");
const { getSettingsRaw } = require("../routes/settings");

function appreciationMatiere(note) {
  if (note < 5) return "Très faible";
  if (note < 8) return "Faible";
  if (note < 10) return "Passable";
  if (note < 12) return "Assez bien";
  if (note < 14) return "Bien";
  if (note < 16) return "Très bien";
  return "Excellent";
}

async function buildContext(idEleve, etablissementId, periodeParam) {
  const eleveRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe",
            serie AS "Serie", annee AS "Annee"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [idEleve, etablissementId]
  );
  const eleve = eleveRes.rows[0];
  if (!eleve) return null;

  const settings = await getSettingsRaw(etablissementId);
  const periode = periodeParam || settings.periode_actuelle;

  const matieres = await getMatieresFor({ etablissementId, niveau: eleve.Niveau, classe: eleve.Classe, serie: eleve.Serie });
  const notesRes = await query(
    `SELECT * FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3`,
    [eleve.ID, etablissementId, periode]
  );
  const notes = notesRes.rows;

  const lignes = await Promise.all(matieres.map(async (m) => {
    const note = notes.find((n) => n.matiere === m.Nom);
    const noteGenerale = note ? Number(note.note_generale) || 0 : 0;
    const noteFinale = note ? Number(note.note_finale) || 0 : noteGenerale * Number(m.Coefficient);
    const rang = (eleve.Niveau !== "Primaire" && note)
      ? await rangMatiere({ idEleve: eleve.ID, matiere: m.Nom, niveau: eleve.Niveau, classe: eleve.Classe, serie: eleve.Serie, etablissementId, periode })
      : null;
    return {
      matiere: m.Nom, categorie: m.Categorie, coefficient: Number(m.Coefficient),
      interro: note ? Number(note.interro) || 0 : 0, devoir: note ? Number(note.devoir) || 0 : 0,
      composition: note ? Number(note.composition) || 0 : 0, noteGenerale, noteFinale,
      professeur: note ? note.professeur : "", rang, appreciation: appreciationMatiere(noteGenerale),
    };
  }));

  const moyenne = Math.round((await moyenneEleve(eleve.ID, eleve.Niveau, etablissementId, periode)) * 100) / 100;
  const mention = getMention(moyenne);
  const decision = moyenne >= 10 ? "Admis(e)" : "Non admis(e) — Peut mieux faire";
  const classementRows = await classement({ etablissementId, niveau: eleve.Niveau, classe: eleve.Classe, serie: eleve.Serie, periode });
  const rangClasse = classementRows.find((e) => Number(e.ID) === Number(eleve.ID));
  const stats = await classStats({ etablissementId, niveau: eleve.Niveau, classe: eleve.Classe, serie: eleve.Serie, periode });

  // Rappel des moyennes des périodes précédentes de l'année + moyenne annuelle (comme sur un vrai bulletin)
  const periodesRes = await query(
    `SELECT DISTINCT periode FROM notes WHERE id_eleve = $1 AND etablissement_id = $2`,
    [eleve.ID, etablissementId]
  );
  const autresPeriodes = periodesRes.rows.map((r) => r.periode).filter((p) => p !== periode);
  const rappelMoyennes = [];
  for (const p of autresPeriodes) {
    const m = Math.round((await moyenneEleve(eleve.ID, eleve.Niveau, etablissementId, p)) * 100) / 100;
    rappelMoyennes.push({ periode: p, moyenne: m });
  }
  const toutesMoyennes = [...rappelMoyennes.map((r) => r.moyenne), moyenne];
  const moyenneAnnuelle = toutesMoyennes.length > 1
    ? Math.round((toutesMoyennes.reduce((a, b) => a + b, 0) / toutesMoyennes.length) * 100) / 100
    : null;

  const totalCoef = lignes.reduce((a, l) => a + l.coefficient, 0);
  const totalPoints = Math.round(lignes.reduce((a, l) => a + l.noteFinale, 0) * 100) / 100;

  return {
    eleve, lignes, moyenne, mention, decision, rangClasse, stats, settings, totalCoef, totalPoints,
    periode, rappelMoyennes, moyenneAnnuelle,
  };
}

function drawHeader(doc, ctx, titre) {
  const { settings, eleve } = ctx;
  const hasLogo = settings.logo && settings.logo.length > 0;

  doc.fontSize(8).font("Helvetica-Bold");
  doc.text(settings.ministere || "MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE ET SECONDAIRE", 40, 40, { width: 280 });
  doc.font("Helvetica").fontSize(7.5);
  if (settings.direction_regionale) doc.text(settings.direction_regionale, 40, doc.y + 2, { width: 280 });
  if (settings.iesg) doc.text(settings.iesg, 40, doc.y + 1, { width: 280 });

  doc.font("Helvetica-Bold").fontSize(8).text("RÉPUBLIQUE TOGOLAISE", 380, 40, { width: 175, align: "right" });
  doc.font("Helvetica-Oblique").fontSize(7.5).text("Travail - Liberté - Patrie", 380, doc.y + 1, { width: 175, align: "right" });

  let y = 78;
  if (hasLogo) {
    try { doc.image(settings.logo, 40, y, { fit: [55, 55] }); } catch (e) { /* logo illisible, on continue sans */ }
  }
  doc.font("Helvetica-Bold").fontSize(13).text((settings.nom || "").toUpperCase(), hasLogo ? 105 : 40, y + 5, { width: 400 });
  doc.font("Helvetica").fontSize(8);
  const contactLine = [settings.adresse, settings.bp && `BP ${settings.bp}`, settings.telephone && `Tél: ${settings.telephone}`]
    .filter(Boolean).join("  —  ");
  if (contactLine) doc.text(contactLine, hasLogo ? 105 : 40, doc.y + 3, { width: 400 });

  y = Math.max(y + 55, doc.y + 15);
  doc.moveTo(40, y).lineTo(555, y).lineWidth(1.4).stroke();
  y += 8;

  doc.font("Helvetica-Bold").fontSize(12).text(titre, 40, y, { width: 515, align: "center" });
  doc.fontSize(9).font("Helvetica").text(
    `Année scolaire ${eleve.Annee || ""} — ${ctx.periode}`,
    40, doc.y + 3, { width: 515, align: "center" }
  );
  doc.y += 10;
}

function drawStudentInfo(doc, ctx) {
  const { eleve, rangClasse, stats } = ctx;
  const y = doc.y;
  doc.rect(40, y, 515, 32).stroke("#C9BFA4");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Nom et Prénom(s) : `, 48, y + 6, { continued: true }).font("Helvetica-Bold")
    .text(`${eleve.Nom} ${eleve.Prenom}`);
  doc.font("Helvetica").text(`Classe : `, 48, y + 19, { continued: true }).font("Helvetica-Bold")
    .text(`${eleve.Classe}${eleve.Serie ? " " + eleve.Serie : ""}`, { continued: true })
    .font("Helvetica").text(`      Effectif : `, { continued: true }).font("Helvetica-Bold")
    .text(`${stats.effectif}`);
  doc.font("Helvetica").fontSize(9).text(`Niveau : ${eleve.Niveau}`, 350, y + 6);
  doc.text(`Rang provisoire : ${rangClasse ? rangClasse.rang : "-"} / ${stats.effectif}`, 350, y + 19);
  doc.y = y + 40;
}

function drawSignatures(doc, ctx, titulaireLabel) {
  const { settings } = ctx;
  let y = doc.y + 20;
  if (y > 760) { doc.addPage(); y = 40; }
  doc.fontSize(9).font("Helvetica");
  doc.text(`Fait à ${settings.adresse ? settings.adresse.split(",")[0] : "____________"}, le ${new Date().toLocaleDateString("fr-FR")}`, 40, y);
  y += 30;
  doc.text(titulaireLabel, 70, y, { width: 160, align: "center" });
  doc.text(settings.type === "Public" ? "Le Proviseur / Directeur" : "Le Directeur / Promoteur", 360, y, { width: 160, align: "center" });
  doc.moveTo(70, y + 45).lineTo(230, y + 45).stroke("#999");
  doc.moveTo(360, y + 45).lineTo(520, y + 45).stroke("#999");
}

function buildPrive(doc, ctx) {
  drawHeader(doc, ctx, "BULLETIN DE NOTES");
  drawStudentInfo(doc, ctx);

  const cols = [
    ["Matière / Professeur", 128], ["Note Cl. 1", 42], ["Note Cl. 2", 42], ["Moy. Cl.", 42],
    ["Compo.", 42], ["Moy. Gén.", 45], ["Coef", 30], ["Points", 40], ["Rang", 32], ["Appréciation", 62],
  ];
  let x = 40;
  const tableTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(7.5);
  for (const [label, w] of cols) { doc.text(label, x + 2, tableTop, { width: w - 4, align: "center" }); x += w; }
  doc.moveTo(40, tableTop + 16).lineTo(555, tableTop + 16).stroke();
  doc.font("Helvetica").fontSize(8);

  let y = tableTop + 20;
  for (const l of ctx.lignes) {
    if (y > 740) { doc.addPage(); y = 40; }
    x = 40;
    const noteClasse = Math.round(((l.interro + l.devoir) / 2) * 100) / 100;
    const vals = [
      `${l.matiere}${l.professeur ? `\n${l.professeur}` : ""}`, l.interro || "-", l.devoir || "-", noteClasse || "-",
      l.composition || "-", l.noteGenerale, l.coefficient, Math.round(l.noteFinale * 100) / 100,
      l.rang || "-", l.appreciation,
    ];
    const rowH = l.professeur ? 24 : 16;
    for (let i = 0; i < cols.length; i++) {
      const [, w] = cols[i];
      doc.fontSize(i === 0 ? 7.5 : 8).text(String(vals[i]), x + 2, y, { width: w - 4, align: i === 0 ? "left" : "center" });
      x += w;
    }
    y += rowH;
    doc.moveTo(40, y - 2).lineTo(555, y - 2).strokeOpacity(0.3).stroke().strokeOpacity(1);
  }

  x = 40;
  doc.font("Helvetica-Bold").fontSize(8);
  const totVals = ["TOTAUX", "", "", "", "", "", ctx.totalCoef, ctx.totalPoints, "", ""];
  for (let i = 0; i < cols.length; i++) {
    const [, w] = cols[i];
    doc.text(String(totVals[i]), x + 2, y + 4, { width: w - 4, align: i === 0 ? "left" : "center" });
    x += w;
  }
  doc.y = y + 24;

  doc.font("Helvetica-Bold").fontSize(10).text(
    `Moyenne du ${ctx.periode} : ${ctx.moyenne} / 20      Rang : ${ctx.rangClasse ? ctx.rangClasse.rang : "-"} / ${ctx.stats.effectif}      Mention : ${ctx.mention}`,
    40, doc.y + 8
  );
  doc.font("Helvetica").fontSize(8).text(
    `Moy. min classe : ${ctx.stats.min}      Moy. max classe : ${ctx.stats.max}      Moy. classe : ${ctx.stats.moyenneClasse}`,
    40, doc.y + 4
  );

  if (ctx.rappelMoyennes.length > 0 || ctx.moyenneAnnuelle !== null) {
    doc.font("Helvetica-Bold").fontSize(9).text("Rappel des moyennes", 40, doc.y + 14);
    doc.font("Helvetica").fontSize(8.5);
    for (const r of ctx.rappelMoyennes) {
      doc.text(`Moyenne du ${r.periode} : ${r.moyenne} / 20`, 40, doc.y + 3);
    }
    if (ctx.moyenneAnnuelle !== null) {
      doc.font("Helvetica-Bold").text(`Moyenne annuelle : ${ctx.moyenneAnnuelle} / 20`, 40, doc.y + 5);
    }
  }

  doc.font("Helvetica-Bold").fontSize(9).text("Observations et décision du conseil de classe", 40, doc.y + 16);
  doc.font("Helvetica").fontSize(9).text(ctx.decision, 40, doc.y + 4);

  drawSignatures(doc, ctx, "Le Titulaire de classe");
}

function buildPublic(doc, ctx) {
  drawHeader(doc, ctx, "BULLETIN DE NOTES");
  drawStudentInfo(doc, ctx);

  const cols = [
    ["Matières", 145], ["Note 1", 38], ["Note 2", 38], ["Compo.", 38],
    ["Moy./20", 45], ["Coef", 32], ["Pond.", 38], ["Rang/Appréciation", 90], ["Professeur", 51],
  ];

  function tableHeader(y) {
    let x = 40;
    doc.font("Helvetica-Bold").fontSize(7.5);
    for (const [label, w] of cols) { doc.text(label, x + 2, y, { width: w - 4, align: "center" }); x += w; }
    doc.moveTo(40, y + 16).lineTo(555, y + 16).stroke();
    return y + 20;
  }

  let y = tableHeader(doc.y);
  doc.font("Helvetica").fontSize(8);

  const categories = [...new Set(ctx.lignes.map((l) => l.categorie))];
  for (const cat of categories) {
    if (y > 720) { doc.addPage(); y = tableHeader(40); }
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#1F3B39");
    doc.text(cat.toUpperCase(), 42, y);
    doc.fillColor("#000000");
    y += 14;

    for (const l of ctx.lignes.filter((x) => x.categorie === cat)) {
      if (y > 740) { doc.addPage(); y = tableHeader(40); }
      let x = 40;
      const pond = Math.round(l.noteFinale * 100) / 100;
      const vals = [l.matiere, l.interro || "-", l.devoir || "-", l.composition || "-",
        l.noteGenerale, l.coefficient, pond, `${l.rang || "-"}è — ${l.appreciation}`, l.professeur || "-"];
      doc.font("Helvetica").fontSize(7.8);
      for (let i = 0; i < cols.length; i++) {
        const [, w] = cols[i];
        doc.text(String(vals[i]), x + 2, y, { width: w - 4, align: i === 0 ? "left" : "center" });
        x += w;
      }
      y += 15;
    }
  }

  doc.moveTo(40, y).lineTo(555, y).stroke();
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text(`TOTAL — Coef : ${ctx.totalCoef}      Pondération : ${ctx.totalPoints}`, 42, y + 5);
  doc.y = y + 24;

  doc.font("Helvetica-Bold").fontSize(10).text(
    `Moyenne du ${ctx.periode} : ${ctx.moyenne} / 20      Rang : ${ctx.rangClasse ? ctx.rangClasse.rang : "-"} / ${ctx.stats.effectif}`,
    40, doc.y + 6
  );
  doc.font("Helvetica").fontSize(8).text(
    `RG (rang général) : ${ctx.rangClasse ? ctx.rangClasse.rang : "-"}è / ${ctx.stats.effectif}      Moy. mini : ${ctx.stats.min}      Moy. maxi : ${ctx.stats.max}      Moy. de la classe : ${ctx.stats.moyenneClasse} / 20`,
    40, doc.y + 4
  );
  doc.font("Helvetica-Bold").fontSize(9).text(`Mention : ${ctx.mention}`, 40, doc.y + 8);

  if (ctx.rappelMoyennes.length > 0 || ctx.moyenneAnnuelle !== null) {
    doc.font("Helvetica-Bold").fontSize(9).text("Rappel des moyennes", 40, doc.y + 12);
    doc.font("Helvetica").fontSize(8.5);
    for (const r of ctx.rappelMoyennes) {
      doc.text(`Moyenne du ${r.periode} : ${r.moyenne} / 20`, 40, doc.y + 3);
    }
    if (ctx.moyenneAnnuelle !== null) {
      doc.font("Helvetica-Bold").text(`Moyenne annuelle : ${ctx.moyenneAnnuelle} / 20`, 40, doc.y + 5);
    }
  }

  doc.font("Helvetica-Bold").fontSize(9).text("Décision du conseil de classe", 40, doc.y + 14);
  doc.font("Helvetica").fontSize(9).text(ctx.decision, 40, doc.y + 4);

  drawSignatures(doc, ctx, "Le Professeur Titulaire");
}

async function genererBulletinPDF(idEleve, etablissementId, periode, res) {
  const ctx = await buildContext(idEleve, etablissementId, periode);
  if (!ctx) { res.status(404).json({ error: "Élève introuvable" }); return; }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="bulletin_${ctx.eleve.Nom}_${ctx.eleve.Prenom}.pdf"`);
  doc.pipe(res);

  if (ctx.settings.type === "Public") buildPublic(doc, ctx);
  else buildPrive(doc, ctx);

  doc.end();
}

module.exports = { genererBulletinPDF };
