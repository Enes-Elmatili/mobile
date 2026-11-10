// app/settings/company.tsx — entreprise & pièces : ce que le prestataire a
// transmis à l'inscription, consultable à tout moment.
//
// En haut, l'entreprise (BCE/TVA vérifiée VIES, raison sociale, adresse, IBAN
// masqué) ; en dessous, chaque pièce exigée avec son état : validée, en
// vérification, refusée (et pourquoi), manquante. Une pièce envoyée s'ouvre
// dans le navigateur intégré (image ou PDF). Seules une pièce refusée ou
// manquante se renvoient ici : remplacer une pièce validée la repasserait
// « en vérification » — ce cas passe par le support.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { localeFor } from '@/lib/format';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { Group, Row, SectionHead, type RowTone } from '@/components/settings/rows';
import { CascadeItem } from '@/lib/motion/useCascade';
import { getRequiredDocuments, type DocumentRequirement } from '@/constants/kycRequirements';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BookSpread, useSplitPane } from '@/lib/layout';

type DocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ServerDoc = { docKey: string; fileUrl?: string | null; status: DocStatus; rejectionReason?: string | null; approvedAt?: string | null; createdAt?: string | null };
type Company = { vatNumber?: string | null; vatVerifiedAt?: string | null; vatLegalName?: string | null; vatAddress?: string | null; bankIban?: string | null; categories?: { name: string }[] };

const SERVER_BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
const fileHref = (url: string) => (/^https?:\/\//.test(url) ? url : `${SERVER_BASE}${url}`);
// Nom de repli quand le sélecteur ne fournit pas de nom de fichier (hors
// composant : Date.now() n'a rien à faire dans le corps d'un rendu).
const fallbackFileName = (key: string, ext: 'jpg' | 'pdf') => `${key}_${Date.now()}.${ext}`;

/** BE68 5390 0754 7034 → BE68 •••• •••• 7034 : assez pour se reconnaître, pas pour recopier. */
export function maskIban(iban?: string | null): string | null {
  const raw = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (raw.length < 8) return raw || null;
  return `${raw.slice(0, 4)} •••• •••• ${raw.slice(-4)}`;
}

export default function CompanyScreen() {
  const insets = useSafeAreaInsets();
  const isSplit = useSplitPane();
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const [company, setCompany] = useState<Company | null>(null);
  const [docs, setDocs] = useState<ServerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, list] = await Promise.all([api.providers.me().catch(() => null), api.providerDocs.list().catch(() => null)]);
    const p = me?.provider ?? me?.data?.provider ?? me?.data ?? me;
    if (p) setCompany(p);
    const d = list?.documents ?? list?.data ?? list;
    if (Array.isArray(d)) setDocs(d);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Les pièces exigées (selon les métiers), puis toute pièce envoyée hors de cette liste.
  const rows = useMemo(() => {
    const required: DocumentRequirement[] = getRequiredDocuments((company?.categories ?? []).map((c) => c.name));
    const byKey = new Map(docs.map((d) => [d.docKey, d]));
    const out: { key: string; label: string; doc?: ServerDoc }[] = required.map((r) => ({ key: r.type, label: t(`kyc.${r.type}_label`, { defaultValue: r.label }), doc: byKey.get(r.type) }));
    for (const d of docs) if (!required.some((r) => r.type === d.docKey)) out.push({ key: d.docKey, label: t(`kyc.${d.docKey}_label`, { defaultValue: d.docKey }), doc: d });
    return out;
  }, [company?.categories, docs, t]);
  const approved = rows.filter((r) => r.doc?.status === 'APPROVED').length;

  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeFor(i18n.language), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const stateOf = (doc?: ServerDoc): { sub: string; value: string; tone: RowTone } => {
    if (!doc) return { sub: t('company.doc_missing_sub'), value: t('company.doc_missing'), tone: 'warn' };
    if (doc.status === 'APPROVED') return { sub: t('company.doc_approved_sub', { date: date(doc.approvedAt ?? doc.createdAt) }), value: t('company.doc_approved'), tone: 'ok' };
    if (doc.status === 'REJECTED') return { sub: doc.rejectionReason || t('company.doc_rejected_sub'), value: t('company.doc_rejected'), tone: 'danger' };
    return { sub: t('company.doc_pending_sub', { date: date(doc.createdAt) }), value: t('company.doc_pending'), tone: 'default' };
  };

  const view = (doc: ServerDoc) => {
    if (!doc.fileUrl) return;
    WebBrowser.openBrowserAsync(fileHref(doc.fileUrl), { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => feedback.error('company.open_error'));
  };

  const upload = async (key: string, file: { uri: string; name: string; type: string }) => {
    setUploading(key);
    try {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
      form.append('docKey', key);
      await api.providerDocs.upload(form);
      feedback.success('onboarding.docs_sent_toast');
      await load();
    } catch (e: any) {
      feedback.error(e?.message || 'onboarding.docs_upload_error');
    } finally {
      setUploading(null);
    }
  };

  // Refusée ou manquante : photo ou PDF (le PDF règle les photos illisibles) ; voir l'envoi refusé si besoin.
  const resend = async (key: string, doc?: ServerDoc) => {
    const options = [{ labelKey: 'onboarding.doc_source_photo' }, { labelKey: 'onboarding.doc_source_pdf' }];
    if (doc?.fileUrl) options.push({ labelKey: 'company.view_sent' });
    const idx = await feedback.actionSheet({ titleKey: 'onboarding.doc_source_title', options, cancelKey: 'common.cancel' });
    if (idx === 0) {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      const a = !res.canceled ? res.assets?.[0] : null;
      if (a) await upload(key, { uri: a.uri, name: a.fileName || fallbackFileName(key, 'jpg'), type: a.mimeType || 'image/jpeg' });
    } else if (idx === 1) {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      const a = !res.canceled ? res.assets?.[0] : null;
      if (a) await upload(key, { uri: a.uri, name: a.name || fallbackFileName(key, 'pdf'), type: a.mimeType || 'application/pdf' });
    } else if (idx === 2 && doc) {
      view(doc);
    }
  };

  const vat = company?.vatNumber || null;
  const iban = maskIban(company?.bankIban);

  const companyBlock = (
          <CascadeItem index={0}>
            <SectionHead title={t('company.section_company')} />
            <Group>
              <Row first icon="briefcase" title={t('company.vat')} sub={company?.vatVerifiedAt ? t('company.vat_verified', { date: date(company.vatVerifiedAt) }) : null} value={vat || t('company.missing')} tone={vat ? (company?.vatVerifiedAt ? 'ok' : 'default') : 'warn'} chevron={false} />
              {company?.vatLegalName ? <Row icon="award" title={t('company.legal_name')} sub={company.vatLegalName} chevron={false} /> : null}
              {company?.vatAddress ? <Row icon="map-pin" title={t('company.address')} sub={company.vatAddress} chevron={false} /> : null}
              <Row icon="credit-card" title={t('company.iban')} value={iban || t('company.missing')} tone={iban ? 'default' : 'warn'} chevron={false} />
            </Group>
          </CascadeItem>
  );
  const docsBlock = (
          <CascadeItem index={1}>
            <SectionHead title={t('company.section_docs')} aside={rows.length ? t('company.docs_approved', { n: approved, total: rows.length }) : null} />
            <Group>
              {rows.map((r, i) => {
                const st = stateOf(r.doc);
                const canResend = !r.doc || r.doc.status === 'REJECTED';
                const busy = uploading === r.key;
                return (
                  <Row
                    key={r.key}
                    first={i === 0}
                    icon={r.doc?.status === 'APPROVED' ? 'check-circle' : r.doc?.status === 'REJECTED' ? 'alert-circle' : 'file-text'}
                    title={r.label}
                    sub={busy ? t('onboarding.doc_uploading') : st.sub}
                    value={canResend ? t('company.resend') : st.value}
                    tone={st.tone}
                    right={busy ? <ActivityIndicator size="small" color={theme.textMuted as string} /> : undefined}
                    onPress={busy ? undefined : canResend ? () => resend(r.key, r.doc) : r.doc?.fileUrl ? () => view(r.doc!) : undefined}
                  />
                );
              })}
            </Group>
            <Text style={[s.note, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{t('company.note')}</Text>
          </CascadeItem>
  );
  const header = <SettingsHeader title={t('profile.company')} fit />;
  const spinner = <View style={s.center}><ActivityIndicator color={theme.textMuted as string} /></View>;
  const scrollBottom = { paddingBottom: Math.max(insets.bottom, 12) + 24 };
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.textMuted as string} />;

  if (isSplit) {
    // Duo déplié : à gauche l'entreprise (BCE, IBAN), à droite les pièces et leur état.
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <BookSpread
          left={
            <>
              {header}
              {loading ? null : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>
                  {companyBlock}
                </ScrollView>
              )}
            </>
          }
          right={loading ? spinner : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.pageTop, scrollBottom]} refreshControl={refresh}>
              {docsBlock}
            </ScrollView>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {header}

      {loading ? (
        spinner
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollBottom}
          refreshControl={refresh}
        >
          {companyBlock}

          {docsBlock}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Page droite : même marge haute que la page gauche.
  pageTop: { paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, paddingHorizontal: 24, paddingTop: 10 },
});
