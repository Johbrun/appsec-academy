// Tests de régression des challenges « facturation & données ».
//
// Ils ÉCHOUENT sur le code livré : c'est leur rôle. Chacun exige deux choses,
// et c'est ce couple qui compte :
//
//   1. le contrôle REFUSE l'attaque ;
//   2. le cas légitime MARCHE ENCORE.
//
// Un correctif qui casse la facturation fait échouer le test aussi sûrement
// qu'un correctif absent. Lance le lab (`npm run dev:api`), corrige, relance
// `npm run verify` jusqu'au vert.

import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { call, devToken, ensureUp, login, refused, reset } from './helpers.ts';

before(ensureUp);
beforeEach(reset);

/** Le secret de signature du processus — rien ne doit le faire sortir. */
const HOST_SECRET = 'lab-secret-novafact';

const accountantToken = async (): Promise<string> => {
  const token = await login('compta@globex.example', 'printemps2024');
  if (!token) throw new Error('le compte comptable ne peut plus se connecter : la correction a cassé le cas légitime.');
  return token;
};

interface InvoiceBody {
  id: string;
  ref: string;
  client: string;
  status: string;
  total: number;
  paid?: boolean;
  refunded?: boolean;
}

const newInvoice = (lines: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ client: 'Test', lines, ...extra });

// ─── M2 · arithmétique des montants ─────────────────────────────────────────

describe('number-coercion · conversion des montants', () => {
  it('refuse une quantité que seul Number() accepterait', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'x', qty: '1e999', unitPrice: 1 }]),
    });
    assert.ok(
      refused(res.status) || Number.isFinite(res.body?.total),
      `facture persistée avec un total non fini (total = ${JSON.stringify(res.body?.total)})`,
    );
  });

  it('crée toujours une facture ordinaire, au bon total', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'x', qty: 3, unitPrice: 19.99 }]),
    });
    assert.equal(res.status, 201, 'la création légitime ne marche plus');
    assert.equal(Math.round(res.body.total * 100), 5997, 'le total de 3 × 19,99 € est faux');
  });
});

describe('max-safe-integer · le total cesse d’incrémenter', () => {
  // L'invariant testable, c'est la monotonie : une quantité qui augmente doit
  // faire augmenter le total. Impossible de comparer à la somme exacte — en
  // flottant, `1e17 + 1` vaut déjà `1e17`.
  it('refuse une facture dont une ligne supplémentaire ne coûte rien', async () => {
    const token = await devToken();
    const une = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'gros', qty: 1, unitPrice: 1e17 }, { label: 'offert', qty: 1, unitPrice: 1 }]),
    });
    const deux = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'gros', qty: 1, unitPrice: 1e17 }, { label: 'offert', qty: 2, unitPrice: 1 }]),
    });
    assert.ok(
      refused(une.status) || refused(deux.status) || deux.body.total > une.body.total,
      `doubler une ligne n’a pas changé le total (${une.body?.total} → ${deux.body?.total})`,
    );
  });

  it('additionne toujours correctement plusieurs lignes', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'a', qty: 2, unitPrice: 10 }, { label: 'b', qty: 1, unitPrice: 5 }]),
    });
    assert.equal(res.status, 201, 'la création légitime ne marche plus');
    assert.equal(res.body.total, 25, 'le total de 2 × 10 € + 1 × 5 € est faux');
  });
});

// ─── M2 · autorisation ──────────────────────────────────────────────────────

describe('bfla-method · la méthode oubliée', () => {
  it('refuse de supprimer la facture d’un autre tenant', async () => {
    const token = await devToken();
    const res = await call('/invoices/INV-1003', { method: 'DELETE', token });
    assert.ok(refused(res.status), `INV-1003 (globex) supprimée par un compte acme — HTTP ${res.status}`);
  });

  it('laisse supprimer une de ses propres factures', async () => {
    const token = await devToken();
    const created = await call<InvoiceBody>('/invoices', {
      method: 'POST', token, body: newInvoice([{ label: 'x', qty: 1, unitPrice: 10 }]),
    });
    const res = await call(`/invoices/${created.body.id}`, { method: 'DELETE', token });
    assert.equal(res.status, 200, 'la suppression légitime ne marche plus');
  });
});

describe('bola-nested · identifiant imbriqué', () => {
  it('refuse de rattacher une facture au client d’un autre tenant', async () => {
    const token = await devToken();
    const res = await call('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'x', qty: 1, unitPrice: 10 }], { clientId: 'CLI-9' }),
    });
    assert.ok(refused(res.status), `facture rattachée à CLI-9 (globex) depuis un compte acme — HTTP ${res.status}`);
  });

  it('laisse rattacher une facture à un client du tenant', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody>('/invoices', {
      method: 'POST', token,
      body: newInvoice([{ label: 'x', qty: 1, unitPrice: 10 }], { clientId: 'CLI-1' }),
    });
    assert.equal(res.status, 201, 'la création légitime avec un client du tenant ne marche plus');
    assert.equal(res.body.client, 'Dupont & Fils', 'le client rattaché n’est plus repris');
  });
});

describe('qs-type-confusion · type du paramètre de recherche', () => {
  it('ne laisse pas un tableau élargir le périmètre', async () => {
    const token = await devToken();
    const res = await call<{ results: InvoiceBody[] }>('/invoices/lookup?tenant[]=acme&tenant[]=globex', { token });
    const foreign = (res.body?.results ?? []).filter((i) => i.ref.startsWith('INV-2') || i.ref === 'INV-1003');
    assert.ok(
      refused(res.status) || foreign.length === 0,
      `${foreign.length} facture(s) d’un autre tenant remontées par ?tenant[]`,
    );
  });

  it('cherche toujours dans son propre périmètre', async () => {
    const token = await devToken();
    const res = await call<{ results: InvoiceBody[] }>('/invoices/lookup?tenant=acme', { token });
    assert.equal(res.status, 200, 'la recherche légitime ne marche plus');
    assert.ok(res.body.results.length >= 2, 'la recherche ne rend plus les factures du tenant');
  });
});

describe('orm-leak · relations jointes', () => {
  it('ne rend jamais une colonne qu’aucune route n’expose', async () => {
    const token = await devToken();
    const res = await call<{ results: { tenantId?: string }[] }>('/invoices/query', {
      method: 'POST', token,
      body: JSON.stringify({ where: { tenantId: { $ne: 'acme' } }, include: ['owner', 'customer'] }),
    });
    const serialized = JSON.stringify(res.body ?? {});
    assert.ok(
      refused(res.status) || (!serialized.includes('passwordHash') && !serialized.includes('"iban"')),
      'une relation jointe a rendu une colonne secrète (passwordHash / iban)',
    );
    const foreign = (res.body?.results ?? []).filter((r) => r.tenantId && r.tenantId !== 'acme');
    assert.ok(refused(res.status) || foreign.length === 0, 'le filtre du client a écrasé la clause de tenant');
  });

  it('filtre toujours les factures du tenant', async () => {
    const token = await devToken();
    const res = await call<{ results: InvoiceBody[] }>('/invoices/query', {
      method: 'POST', token, body: JSON.stringify({ where: { status: 'sent' } }),
    });
    assert.equal(res.status, 200, 'la recherche filtrée légitime ne marche plus');
    assert.ok(res.body.results.length >= 1, 'le filtre status=sent ne rend plus rien');
  });
});

// ─── M2 · échec et état ─────────────────────────────────────────────────────

describe('error-leak · réémission d’une facture', () => {
  it('échoue proprement, sans pile et sans facture à moitié écrite', async () => {
    const token = await devToken();
    const res = await call<{ stack?: string }>('/invoices/INV-1001/reissue', {
      method: 'POST', token, body: JSON.stringify({ spec: 'pas du json' }),
    });
    assert.ok(refused(res.status), `erreur non gérée renvoyée au client — HTTP ${res.status}`);
    assert.equal(res.body?.stack, undefined, 'la trace d’exécution du serveur est partie au client');

    const after = await call<InvoiceBody>('/invoices/INV-1001', { token });
    assert.equal(after.body.total, 490, 'INV-1001 a été laissée avec un total incohérent');
    assert.equal(after.body.status, 'sent', 'INV-1001 a été laissée dans un statut incohérent');
  });

  it('réémet toujours une facture avec une spécification valide', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody>('/invoices/INV-1001/reissue', {
      method: 'POST', token,
      body: JSON.stringify({ spec: JSON.stringify({ lines: [{ label: 'x', qty: 2, unitPrice: 100 }] }) }),
    });
    assert.equal(res.status, 200, 'la réémission légitime ne marche plus');
    assert.equal(res.body.total, 200, 'le total réémis est faux');
  });
});

describe('race-multi-endpoint · paiement et annulation', () => {
  it('ne laisse pas une facture être payée et remboursée', async () => {
    const token = await devToken();
    await Promise.all([
      call('/invoices/INV-1001/pay', { method: 'POST', token, body: '{}' }),
      call('/invoices/INV-1001/refund', { method: 'POST', token, body: '{}' }),
    ]);
    const after = await call<InvoiceBody>('/invoices/INV-1001', { token });
    assert.ok(
      !(after.body.paid && after.body.refunded),
      'INV-1001 est simultanément payée et remboursée : deux états qui s’excluent',
    );
  });

  it('enregistre toujours un paiement seul', async () => {
    const token = await devToken();
    const res = await call<{ paid: boolean }>('/invoices/INV-1001/pay', { method: 'POST', token, body: '{}' });
    assert.equal(res.status, 200, 'le paiement légitime ne marche plus');
    assert.equal(res.body.paid, true, 'la facture n’est plus marquée payée');
  });
});

// ─── M3 · cache et liens ────────────────────────────────────────────────────

describe('vary-missing · liste des factures et cache partagé', () => {
  it('ne sert pas la liste à un appelant sans jeton', async () => {
    const token = await devToken();
    const warm = await call('/invoices', { token });
    assert.equal(warm.status, 200, 'la liste n’est plus servie à un compte authentifié');
    assert.ok(
      /private|no-store/.test(warm.headers.get('cache-control') ?? ''),
      `réponse authentifiée mise en cache partagé : Cache-Control: ${warm.headers.get('cache-control')}`,
    );

    const anonymous = await call('/invoices');
    assert.ok(refused(anonymous.status), `liste des factures servie sans jeton — HTTP ${anonymous.status}`);
  });

  it('sert toujours la liste du tenant courant', async () => {
    const token = await devToken();
    const res = await call<InvoiceBody[]>('/invoices', { token });
    assert.equal(res.status, 200, 'la liste légitime ne marche plus');
    assert.ok(res.body.some((i) => i.ref === 'INV-1001'), 'la liste ne contient plus les factures du tenant');
  });
});

describe('token-in-url · lien de consultation', () => {
  it('ne met jamais le jeton d’accès dans une URL', async () => {
    const token = await devToken();
    const share = await call<{ url: string }>('/invoices/INV-1001/share', { token });
    assert.equal(share.status, 200, 'le lien de partage ne se crée plus');
    assert.ok(
      !/[?&](token|access_token)=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(share.body.url),
      `le lien de partage porte un jeton dans son URL : ${share.body.url}`,
    );

    const direct = await call(`/invoices/INV-1001/view?token=${token}`);
    assert.ok(refused(direct.status), `un jeton passé en query string a été accepté — HTTP ${direct.status}`);
  });

  it('le lien de partage ouvre toujours la facture', async () => {
    const token = await devToken();
    const share = await call<{ url: string }>('/invoices/INV-1001/share', { token });
    const page = await call(share.body.url.replace(/^\/api/, ''));
    assert.equal(page.status, 200, 'le lien de consultation légitime ne marche plus');
    assert.ok(page.text.includes('INV-1001'), 'la page de consultation n’affiche plus la facture');
  });
});

// ─── M10 · abus de la sortie ────────────────────────────────────────────────

describe('send-quota · envoi de factures', () => {
  it('finit par refuser un envoi en masse', async () => {
    const token = await devToken();
    let rejected = 0;
    for (let i = 0; i < 40; i++) {
      const res = await call('/invoices/INV-1001/send', {
        method: 'POST', token,
        body: JSON.stringify({ to: `cible${i}@exemple.test`, subject: 'Remboursement', body: 'Cliquez ici' }),
      });
      if (refused(res.status)) rejected++;
    }
    assert.ok(rejected > 0, '40 envois consécutifs acceptés depuis un compte neuf : aucun quota');
  });

  it('laisse envoyer une facture', async () => {
    const token = await devToken();
    const res = await call<{ sent: boolean }>('/invoices/INV-1001/send', { method: 'POST', token, body: '{}' });
    assert.equal(res.status, 200, 'l’envoi légitime d’une facture ne marche plus');
    assert.equal(res.body.sent, true, 'la facture n’est plus envoyée');
  });
});

// ─── M2 · flux en plusieurs étapes ──────────────────────────────────────────

describe('multistep-authz · émission d’un avoir', () => {
  it('refuse d’émettre un avoir sans l’étape comptable', async () => {
    const token = await devToken();
    const lines = await call('/credits/drafts/CND-99/lines', { method: 'POST', token, body: JSON.stringify({ amount: 5000 }) });
    const issued = await call('/credits/drafts/CND-99/issue', { method: 'POST', token, body: '{}' });
    assert.ok(
      refused(lines.status) || refused(issued.status),
      'un compte sans rôle comptable a émis un avoir de bout en bout',
    );

    const credits = await call<{ balance: number }[]>('/credits', { token });
    assert.ok(!credits.body.some((c) => c.balance === 5000), 'un avoir de 5000 € a été créé sans approbation');
  });

  it('laisse le rôle comptable émettre un avoir', async () => {
    const token = await accountantToken();
    const draft = await call<{ id: string }>('/credits/drafts', { method: 'POST', token, body: '{}' });
    assert.equal(draft.status, 201, 'l’ouverture d’un brouillon d’avoir ne marche plus');
    const lines = await call(`/credits/drafts/${draft.body.id}/lines`, { method: 'POST', token, body: JSON.stringify({ amount: 120 }) });
    assert.equal(lines.status, 200, 'la saisie du montant ne marche plus');
    const issued = await call(`/credits/drafts/${draft.body.id}/issue`, { method: 'POST', token, body: '{}' });
    assert.equal(issued.status, 201, 'l’émission légitime d’un avoir ne marche plus');
  });
});

// ─── M2 / M3 · exécution de code ────────────────────────────────────────────

describe('eval-formula · formule de pénalité', () => {
  it('refuse une formule qui n’est pas une expression arithmétique', async () => {
    const token = await devToken();
    const res = await call<{ penalty: unknown }>('/settings/penalty', {
      method: 'POST', token, body: JSON.stringify({ formula: 'process.pid' }),
    });
    assert.ok(
      refused(res.status) || res.body?.penalty === null,
      `du JavaScript arbitraire a été évalué côté serveur (résultat = ${JSON.stringify(res.body?.penalty)})`,
    );
  });

  it('calcule toujours une pénalité légitime', async () => {
    const token = await devToken();
    const res = await call<{ penalty: number }>('/settings/penalty', {
      method: 'POST', token, body: JSON.stringify({ formula: 'amount * days * rate', amount: 1000, days: 30 }),
    });
    assert.equal(res.status, 200, 'le calcul légitime de pénalité ne marche plus');
    assert.ok(Math.abs(res.body.penalty - 30) < 1e-6, `pénalité attendue ≈ 30, obtenue ${res.body.penalty}`);
  });
});

describe('vm-escape · bac à sable de la formule', () => {
  it('ne laisse rien du processus hôte sortir du calcul', async () => {
    const token = await devToken();
    const res = await call('/settings/penalty', {
      method: 'POST', token,
      body: JSON.stringify({
        engine: 'sandbox',
        formula: "this.constructor.constructor('return process.env.NOVAFACT_JWT_SECRET')()",
      }),
    });
    assert.ok(
      refused(res.status) || !JSON.stringify(res.body ?? {}).includes(HOST_SECRET),
      'le secret de signature des jetons est sorti du contexte d’évaluation',
    );
  });

  it('calcule toujours une pénalité en mode isolé', async () => {
    const token = await devToken();
    const res = await call<{ penalty: number }>('/settings/penalty', {
      method: 'POST', token, body: JSON.stringify({ engine: 'sandbox', formula: 'amount * 2', amount: 21 }),
    });
    assert.equal(res.status, 200, 'le calcul légitime en mode isolé ne marche plus');
    assert.equal(res.body.penalty, 42, 'le calcul isolé rend un mauvais résultat');
  });
});

describe('dual-use-endpoint · périmètre des réglages', () => {
  it('ne laisse pas un compte tenant écrire un réglage de plateforme', async () => {
    const token = await devToken();
    await call('/settings', { method: 'PUT', token, body: JSON.stringify({ scope: 'platform', maintenanceMode: true }) });
    const platform = await call<{ maintenanceMode: boolean }>('/platform', { token });
    assert.equal(platform.body.maintenanceMode, false, 'un réglage de la plateforme a été modifié depuis un compte tenant');
  });

  it('enregistre toujours un réglage du tenant', async () => {
    const token = await devToken();
    const res = await call<{ theme: string }>('/settings', { method: 'PUT', token, body: JSON.stringify({ theme: 'dark' }) });
    assert.equal(res.status, 200, 'la mise à jour légitime des réglages ne marche plus');
    const after = await call<{ theme: string }>('/settings', { token });
    assert.equal(after.body.theme, 'dark', 'le réglage du tenant n’est plus enregistré');
  });
});

// ─── M3 / M4 / M8 · pièces jointes ──────────────────────────────────────────

const upload = (token: string, body: Record<string, unknown>) =>
  call<{ id?: string; url?: string }>('/attachments', { method: 'POST', token, body: JSON.stringify(body) });

describe('toctou-upload · validation du téléversement', () => {
  it('ne sert jamais un fichier que la validation refuse', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'facture.html', contentType: 'text/html', content: '<script>1</script>' });
    if (!refused(up.status)) {
      const fetched = await call(`/attachments/u/${up.body.id}`, { token });
      assert.ok(refused(fetched.status), `pièce jointe refusée par la validation servie entre-temps — HTTP ${fetched.status}`);
    }
  });

  it('accepte et sert toujours une pièce jointe valide', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'note.txt', contentType: 'text/plain', content: 'bonjour' });
    assert.equal(up.status, 201, 'le téléversement légitime ne marche plus');
    await new Promise((r) => setTimeout(r, 600));
    const fetched = await call(`/attachments/u/${up.body.id}`, { token });
    assert.equal(fetched.status, 200, 'la pièce jointe valide n’est plus téléchargeable');
    assert.ok(fetched.text.includes('bonjour'), 'le contenu de la pièce jointe a changé');
  });
});

describe('upload-pipeline · type servi et origine', () => {
  it('ne sert pas un fichier exécutable dans l’origine de l’application', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'note.pdf', contentType: 'text/html', content: '<b>facture</b>' });
    if (refused(up.status)) return;
    const fetched = await call(`/attachments/u/${up.body.id}`, { token });
    if (refused(fetched.status)) return;
    assert.ok(
      !/text\/html|svg|javascript/i.test(fetched.headers.get('content-type') ?? ''),
      `pièce jointe servie en ${fetched.headers.get('content-type')} sur l’origine de l’application`,
    );
    assert.equal(fetched.headers.get('x-content-type-options'), 'nosniff', 'le reniflage de type n’est pas désactivé');
  });

  it('laisse toujours télécharger une pièce jointe', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'note.txt', contentType: 'text/plain', content: 'contenu' });
    await new Promise((r) => setTimeout(r, 600));
    const fetched = await call(`/attachments/u/${up.body.id}`, { token });
    assert.equal(fetched.status, 200, 'le téléchargement légitime ne marche plus');
  });
});

describe('attachment-same-origin · pièce jointe ouverte dans le navigateur', () => {
  it('ne laisse pas un document actif être parsé par le navigateur', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'piege.html', contentType: 'text/html', content: '<script>fetch("/api/me")</script>' });
    if (refused(up.status)) return;
    const fetched = await call(`/attachments/u/${up.body.id}`, {
      token, headers: { 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Site': 'same-origin' },
    });
    if (refused(fetched.status)) return;
    const disposition = fetched.headers.get('content-disposition') ?? '';
    assert.ok(
      /attachment/i.test(disposition) && !/text\/html/i.test(fetched.headers.get('content-type') ?? ''),
      'une pièce jointe s’exécute dans l’origine de Novafact quand un utilisateur l’ouvre',
    );
  });

  it('sert toujours le contenu d’une pièce jointe légitime', async () => {
    const token = await devToken();
    const up = await upload(token, { name: 'note.txt', contentType: 'text/plain', content: 'rapport trimestriel' });
    await new Promise((r) => setTimeout(r, 600));
    const fetched = await call(`/attachments/u/${up.body.id}`, { token });
    assert.ok(fetched.text.includes('rapport trimestriel'), 'le contenu légitime n’est plus servi');
  });
});

describe('svg-logo · logo du tenant', () => {
  const ACTIVE = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5" onload="alert(2)"/></svg>';

  it('ne sert jamais un SVG porteur de script', async () => {
    const token = await devToken();
    const up = await call('/attachments/logo', {
      method: 'POST', token, body: JSON.stringify({ contentType: 'image/svg+xml', content: ACTIVE }),
    });
    if (refused(up.status)) return;
    const served = await call('/attachments/logo/acme', { token, headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.ok(!/<script/i.test(served.text), 'le logo SVG est servi avec ses scripts');
    assert.ok(!/\son[a-z]+\s*=/i.test(served.text), 'le logo SVG est servi avec ses gestionnaires d’événements');
  });

  it('accepte et sert toujours un logo SVG inoffensif', async () => {
    const token = await devToken();
    const up = await call('/attachments/logo', {
      method: 'POST', token,
      body: JSON.stringify({ contentType: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>' }),
    });
    assert.equal(up.status, 201, 'le téléversement légitime d’un logo ne marche plus');
    const served = await call('/attachments/logo/acme', { token });
    assert.equal(served.status, 200, 'le logo n’est plus servi');
    assert.ok(served.text.includes('<circle'), 'le logo légitime a été vidé de son contenu');
  });
});

// ─── M2 / M3 · export ───────────────────────────────────────────────────────

describe('cmd-injection · génération du PDF', () => {
  it('traite le nom du document comme une donnée, pas comme une commande', async () => {
    const token = await devToken();
    const res = await call<{ produced: string | null }>('/export/pdf', {
      method: 'POST', token, body: JSON.stringify({ invoiceId: 'INV-1001', name: '$(id)' }),
    });
    assert.ok(
      refused(res.status) || res.body?.produced === '%PDF-1.4 INV-1001 $(id)',
      `le shell a exécuté autre chose que la génération (produit : ${JSON.stringify(res.body?.produced)})`,
    );
  });

  it('génère toujours le document d’une facture', async () => {
    const token = await devToken();
    const res = await call<{ produced: string | null }>('/export/pdf', {
      method: 'POST', token, body: JSON.stringify({ invoiceId: 'INV-1001', name: 'Martin SAS' }),
    });
    assert.equal(res.status, 200, 'la génération légitime ne marche plus');
    assert.equal(res.body.produced, '%PDF-1.4 INV-1001 Martin SAS', 'le document produit est faux');
  });
});

describe('csv-formula-injection · export comptable', () => {
  it('neutralise les cellules qui commenceraient par un caractère de formule', async () => {
    const token = await devToken();
    await call('/invoices/INV-1001', {
      method: 'PATCH', token, body: JSON.stringify({ client: '=HYPERLINK("http://attaquant.invalid","Facture")' }),
    });
    const csv = await call('/export/csv', { token });
    assert.ok(!/(^|;)=/m.test(csv.text), 'une cellule de l’export commence par « = » : elle s’exécutera chez le destinataire');
  });

  it('exporte toujours les factures du tenant', async () => {
    const token = await devToken();
    const csv = await call('/export/csv', { token });
    assert.equal(csv.status, 200, 'l’export CSV légitime ne marche plus');
    assert.ok(csv.text.includes('INV-1002') && csv.text.includes('Martin SAS'), 'l’export ne contient plus les factures');
  });
});

describe('cache-deception-pdf · PDF de facture', () => {
  it('ne sert pas un PDF authentifié à un appelant sans session', async () => {
    const token = await devToken();
    await call('/export/invoice/INV-1001.pdf', { token });
    const anonymous = await call('/export/invoice/INV-1001.pdf');
    assert.ok(refused(anonymous.status), `PDF d’une facture servi sans session — HTTP ${anonymous.status}`);
  });

  it('sert toujours le PDF au titulaire de la facture', async () => {
    const token = await devToken();
    const res = await call('/export/invoice/INV-1001', { token });
    assert.equal(res.status, 200, 'le PDF légitime n’est plus servi');
    assert.ok(res.text.includes('INV-1001'), 'le PDF ne contient plus la facture');
  });
});

describe('ssrf-pdf-renderer · moteur de rendu', () => {
  it('ne va chercher aucune ressource désignée par le tenant', async () => {
    const token = await devToken();
    const res = await call<{ resources: unknown[]; pdf: string }>('/export/render', {
      method: 'POST', token, body: JSON.stringify({ header: '<iframe src="file:///etc/passwd"></iframe>' }),
    });
    assert.ok(
      refused(res.status) || ((res.body?.resources ?? []).length === 0 && !/root:/.test(res.body?.pdf ?? '')),
      'le moteur de rendu a lu un fichier local et l’a inliné dans le PDF',
    );
  });

  it('rend toujours l’en-tête du tenant', async () => {
    const token = await devToken();
    const res = await call<{ pdf: string }>('/export/render', {
      method: 'POST', token, body: JSON.stringify({ header: 'Facture éditée par ACME SARL' }),
    });
    assert.equal(res.status, 200, 'le rendu légitime ne marche plus');
    assert.ok(res.body.pdf.includes('ACME SARL'), 'l’en-tête du tenant n’apparaît plus dans le PDF');
  });
});

describe('ssti-render-options · options de rendu', () => {
  it('ne laisse pas une option de compilation venir de la query string', async () => {
    const token = await devToken();
    const reference = await call<{ rendered: string }>('/export/preview', { token });
    const payload = encodeURIComponent('String(globalThis.__pwn = 1) + String');
    const res = await call<{ rendered: string }>(`/export/preview?escape=${payload}`, { token });
    assert.ok(
      refused(res.status) || res.body?.rendered === reference.body.rendered,
      `une option de rendu fournie par le client a changé le programme exécuté (rendu : ${res.body?.rendered})`,
    );
  });

  it('rend toujours l’aperçu par défaut', async () => {
    const token = await devToken();
    const res = await call<{ rendered: string }>('/export/preview', { token });
    assert.equal(res.status, 200, 'l’aperçu légitime ne marche plus');
    assert.ok(res.body.rendered.includes('INV-1001'), 'l’aperçu n’affiche plus la facture');
  });
});

// ─── M3 · gabarits et modèles ───────────────────────────────────────────────

describe('ssti-email-template · gabarit de relance', () => {
  it('ne laisse pas un gabarit lire le processus serveur', async () => {
    const token = await devToken();
    await call('/templates/TPL-1', { method: 'PUT', token, body: JSON.stringify({ body: 'Bonjour {{ process.env.NOVAFACT_JWT_SECRET }}' }) });
    const res = await call<{ rendered: string | null }>('/templates/TPL-1/preview', { method: 'POST', token, body: '{}' });
    assert.ok(
      !JSON.stringify(res.body ?? {}).includes(HOST_SECRET),
      'le secret de signature des jetons est apparu dans le message rendu',
    );
  });

  it('rend toujours les variables du gabarit', async () => {
    const token = await devToken();
    await call('/templates/TPL-1', { method: 'PUT', token, body: JSON.stringify({ body: 'Facture {{ ref }} pour {{ client }}' }) });
    const res = await call<{ rendered: string }>('/templates/TPL-1/preview', { method: 'POST', token, body: '{}' });
    assert.equal(res.status, 200, 'l’aperçu légitime du gabarit ne marche plus');
    assert.ok(res.body.rendered.includes('INV-1001'), 'les variables du gabarit ne sont plus rendues');
  });
});

describe('deserialization · import d’un modèle', () => {
  it('n’exécute rien de ce qu’un modèle importé contient', async () => {
    const token = await devToken();
    const res = await call<{ executed?: string[] }>('/templates/import', {
      method: 'POST', token,
      body: JSON.stringify({
        model: {
          $type: 'Template', name: 'Forgé', body: 'x',
          onLoad: { $type: 'Function', source: 'return process.env.NOVAFACT_JWT_SECRET' },
        },
      }),
    });
    assert.ok(
      refused(res.status) || ((res.body?.executed ?? []).length === 0 && !JSON.stringify(res.body ?? {}).includes(HOST_SECRET)),
      'un modèle importé a fait exécuter du code au serveur',
    );
  });

  it('importe toujours un modèle ordinaire', async () => {
    const token = await devToken();
    const res = await call<{ imported: { name: string } }>('/templates/import', {
      method: 'POST', token,
      body: JSON.stringify({ model: { name: 'Relance à J+60', subject: 'Facture {{ref}}', body: 'Bonjour {{ client }}' } }),
    });
    assert.equal(res.status, 201, 'l’import légitime d’un modèle ne marche plus');
    assert.equal(res.body.imported.name, 'Relance à J+60', 'le modèle importé a perdu son nom');
  });
});

// ─── M2 · import ────────────────────────────────────────────────────────────

describe('zip-slip · extraction d’une archive', () => {
  it('refuse une entrée qui sort du dossier d’import', async () => {
    const token = await devToken();
    const res = await call<{ extracted: { written: boolean }[] }>('/import/archive', {
      method: 'POST', token,
      body: JSON.stringify({ entries: [{ name: '../../tenants/globex/settings.json', content: '{"signataire":"Attaquant"}' }] }),
    });
    const written = (res.body?.extracted ?? []).some((e) => e.written);
    assert.ok(refused(res.status) || !written, 'une entrée d’archive a été écrite hors du dossier d’import');
  });

  it('extrait toujours une archive ordinaire', async () => {
    const token = await devToken();
    const res = await call<{ extracted: { written: boolean }[] }>('/import/archive', {
      method: 'POST', token,
      body: JSON.stringify({ entries: [{ name: 'lot/facture-1.xml', content: '<facture/>' }] }),
    });
    assert.equal(res.status, 201, 'l’extraction légitime ne marche plus');
    assert.equal(res.body.extracted[0].written, true, 'l’entrée légitime n’est plus extraite');
  });
});

const xml = (token: string, body: string) =>
  call('/import/facturx', { method: 'POST', token, body, headers: { 'Content-Type': 'application/xml' } });

describe('xxe-import · entités externes', () => {
  it('ne résout aucune entité externe', async () => {
    const token = await devToken();
    const res = await xml(
      token,
      '<?xml version="1.0"?>\n<!DOCTYPE facture [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>\n' +
        '<facture><ref>INV-XXE</ref><client>ACME</client><note>&xxe;</note></facture>',
    );
    assert.ok(
      refused(res.status) || !/root:/.test(res.text),
      'le contenu d’un fichier local est arrivé dans la facture créée',
    );
  });

  it('importe toujours une facture électronique ordinaire', async () => {
    const token = await devToken();
    const res = await call<{ invoice: InvoiceBody }>('/import/facturx', {
      method: 'POST', token, headers: { 'Content-Type': 'application/xml' },
      body: '<?xml version="1.0"?><facture><ref>INV-FX1</ref><client>Dupont &amp; Fils</client>' +
        '<line label="Conseil" qty="2" unitPrice="150"/><note>Merci.</note></facture>',
    });
    assert.equal(res.status, 201, 'l’import Factur-X légitime ne marche plus');
    assert.equal(res.body.invoice.client, 'Dupont & Fils', 'les entités prédéfinies ne sont plus résolues');
    assert.equal(res.body.invoice.total, 300, 'les lignes importées ne sont plus additionnées');
  });
});

describe('xml-entity-expansion · budget du parseur', () => {
  it('refuse le document avant de l’avoir expansé', async () => {
    const token = await devToken();
    const entities = ['<!ENTITY lol "lololololololololololololololol">'];
    for (let i = 1; i <= 6; i++) {
      entities.push(`<!ENTITY lol${i} "${`&lol${i - 1 === 0 ? '' : i - 1};`.repeat(10)}">`);
    }
    const started = Date.now();
    const res = await call<{ expandedBytes?: number }>('/import/facturx', {
      method: 'POST', token, headers: { 'Content-Type': 'application/xml' },
      body: `<?xml version="1.0"?>\n<!DOCTYPE lolz [\n${entities.join('\n')}\n]>\n<facture><note>&lol6;</note></facture>`,
    });
    const elapsed = Date.now() - started;

    assert.ok(refused(res.status), `document à expansion exponentielle accepté — HTTP ${res.status}`);
    assert.ok(
      (res.body?.expandedBytes ?? 0) < 100_000,
      `le parseur a produit ${res.body?.expandedBytes} octets avant d’abandonner : la limite arrive trop tard`,
    );
    assert.ok(elapsed < 2000, `le refus a pris ${elapsed} ms`);
  });

  it('accepte toujours un document XML ordinaire', async () => {
    const token = await devToken();
    const res = await call<{ invoice: InvoiceBody }>('/import/facturx', {
      method: 'POST', token, headers: { 'Content-Type': 'application/xml' },
      body: '<?xml version="1.0"?><facture><ref>INV-FX2</ref><client>Martin</client><note>Deux &lt; trois</note></facture>',
    });
    assert.equal(res.status, 201, 'l’import XML légitime ne marche plus');
    assert.equal(res.body.invoice.ref, 'INV-FX2', 'la référence importée est perdue');
  });
});

describe('json-duplicate-keys · schéma et analyseur', () => {
  const raw = (token: string, body: string) =>
    call<InvoiceBody & { error?: string }>('/import/invoice-json', {
      method: 'POST', token, body, headers: { 'Content-Type': 'text/plain' },
    });

  it('ne stocke jamais la valeur que le schéma venait de refuser', async () => {
    const token = await devToken();
    const res = await raw(token, '{"client":"X","lines":[{"label":"L","qty":1,"unitPrice":10,"unitPrice":999999999}]}');
    assert.ok(
      refused(res.status) || res.body?.total === 10,
      `le montant stocké (${res.body?.total}) est celui que le schéma avait refusé`,
    );
  });

  it('importe toujours un document ordinaire', async () => {
    const token = await devToken();
    const res = await raw(token, '{"client":"Dupont","lines":[{"label":"L","qty":2,"unitPrice":10}]}');
    assert.equal(res.status, 201, 'l’import JSON légitime ne marche plus');
    assert.equal(res.body.total, 20, 'le total importé est faux');
  });
});

// ─── M3 · annuaire ──────────────────────────────────────────────────────────

describe('param-pollution · recherche de clients', () => {
  it('ne laisse pas injecter un paramètre dans l’appel interne', async () => {
    const token = await devToken();
    const res = await call<{ results: Record<string, unknown>[] }>(
      `/clients?q=${encodeURIComponent('Dupont&fields=*')}`, { token },
    );
    const serialized = JSON.stringify(res.body?.results ?? []);
    assert.ok(
      refused(res.status) || (!serialized.includes('iban') && !serialized.includes('siret')),
      'un paramètre injecté a élargi la projection de l’appel interne',
    );
  });

  it('cherche toujours dans l’annuaire du tenant', async () => {
    const token = await devToken();
    const res = await call<{ results: { name: string }[] }>('/clients?q=Dupont', { token });
    assert.equal(res.status, 200, 'la recherche légitime ne marche plus');
    assert.ok(res.body.results.some((c) => c.name === 'Dupont & Fils'), 'la recherche ne rend plus les clients du tenant');
  });
});
