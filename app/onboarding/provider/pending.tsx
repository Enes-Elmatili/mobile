import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../../../lib/api';
import { useEffect, useRef, useState } from 'react';

interface DocStatus {
  id: string;
  docKey: string;
  status: string;
  rejectionReason?: string | null;
}

export default function PendingValidation() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'suspended'>('pending');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [documents, setDocuments] = useState<DocStatus[]>([]);
  const stripeConnectedRef = useRef(false);

  async function checkStatus() {
    try {
      const needsStripeCheck = !stripeConnectedRef.current;

      const [validationRes, stripeRes, docsRes]: any[] = await Promise.all([
        api.providers.validationStatus(),
        needsStripeCheck ? api.connect.status() : null,
        api.providerDocs.list(),
      ]);

      if (docsRes?.documents) {
        setDocuments(docsRes.documents);
      }

      if (stripeRes) {
        const connected = !!(stripeRes.isConnected || stripeRes.isStripeReady);
        stripeConnectedRef.current = connected;
        setStripeConnected(connected);
      }

      if (validationRes.providerStatus === 'ACTIVE') {
        setStatus('approved');
        setTimeout(() => router.replace('/(tabs)/provider-dashboard'), 1500);
        return true;
      } else if (validationRes.providerStatus === 'REJECTED') {
        setStatus('rejected');
        return true;
      } else if (validationRes.providerStatus === 'SUSPENDED') {
        setStatus('suspended');
        return true;
      }
    } catch {
      // Silent
    }
    return false;
  }

  useEffect(() => {
    checkStatus();

    const interval = setInterval(async () => {
      const done = await checkStatus();
      if (done) clearInterval(interval);
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={s.content}>
        {status === 'pending' && (
          <>
            <View style={s.iconCircle}>
              <Ionicons name="time-outline" size={40} color="#fff" />
            </View>
            <Text style={s.title}>{'Dossier en cours\nde vérification.'}</Text>
            <Text style={s.subtitle}>
              {'Notre équipe vérifie vos documents et qualifications.\nVous recevrez un email dès que votre compte sera activé.'}
            </Text>

            <View style={s.stepsCard}>
              {[
                { label: 'Dossier reçu', done: true },
                { label: 'Stripe configuré', done: stripeConnected },
                { label: 'Vérification en cours', done: false },
              ].map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepDot, step.done && s.stepDotDone]}>
                    {step.done && <Ionicons name="checkmark" size={10} color="#000" />}
                  </View>
                  <Text style={[s.stepLabel, step.done && s.stepLabelDone]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>

            {documents.length > 0 && (
              <View style={s.docsCard}>
                <Text style={s.docsTitle}>Vos documents</Text>
                {documents.map((doc) => (
                  <View key={doc.id} style={s.docRow}>
                    <Ionicons
                      name={doc.status === 'APPROVED' ? 'checkmark-circle' : doc.status === 'REJECTED' ? 'close-circle' : 'time-outline'}
                      size={16}
                      color={doc.status === 'APPROVED' ? '#4ADE80' : doc.status === 'REJECTED' ? '#EF4444' : 'rgba(255,255,255,0.35)'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docLabel}>{doc.docKey.replace(/_/g, ' ')}</Text>
                      {doc.status === 'REJECTED' && doc.rejectionReason && (
                        <Text style={s.docReason}>{doc.rejectionReason}</Text>
                      )}
                    </View>
                    <Text style={[
                      s.docStatus,
                      doc.status === 'APPROVED' && { color: '#4ADE80' },
                      doc.status === 'REJECTED' && { color: '#EF4444' },
                    ]}>
                      {doc.status === 'APPROVED' ? 'Validé' : doc.status === 'REJECTED' ? 'Refusé' : 'En attente'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!stripeConnected && (
              <TouchableOpacity
                style={s.stripeCta}
                onPress={() => router.push('/onboarding/provider/stripe-connect')}
              >
                <Ionicons name="card-outline" size={18} color="#0a0a0a" />
                <Text style={s.stripeCtaText}>Configurer mon compte Stripe</Text>
              </TouchableOpacity>
            )}

            <Text style={s.eta}>Vous recevrez un email de confirmation sous 24–48h.</Text>
          </>
        )}

        {status === 'approved' && (
          <>
            <View style={[s.iconCircle, s.iconCircleGreen]}>
              <Ionicons name="checkmark" size={40} color="#0a0a0a" />
            </View>
            <Text style={s.title}>Compte activé !</Text>
            <Text style={s.subtitle}>Bienvenue sur FIXED. Vous pouvez maintenant recevoir des missions.</Text>
          </>
        )}

        {status === 'rejected' && (
          <>
            <View style={[s.iconCircle, s.iconCircleRed]}>
              <Ionicons name="close" size={40} color="#fff" />
            </View>
            <Text style={s.title}>Dossier non validé.</Text>
            <Text style={s.subtitle}>
              Votre dossier n'a pas pu être validé. Vérifiez vos documents et réessayez.
            </Text>
            <TouchableOpacity
              style={s.retryBtn}
              onPress={() => router.replace('/onboarding/provider/documents')}
            >
              <Text style={s.retryBtnText}>Corriger mon dossier</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'suspended' && (
          <>
            <View style={[s.iconCircle, s.iconCircleRed]}>
              <Ionicons name="ban-outline" size={40} color="#fff" />
            </View>
            <Text style={s.title}>Compte suspendu.</Text>
            <Text style={s.subtitle}>
              {'Votre compte prestataire a été temporairement suspendu.\nContactez le support pour plus d\'informations.'}
            </Text>
            <TouchableOpacity
              style={s.retryBtn}
              onPress={() => router.push('/settings/support')}
            >
              <Text style={s.retryBtnText}>Contacter le support</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Le provider est déjà connecté — pas de bouton déconnexion */}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'space-between', padding: 28 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  iconCircleGreen: { backgroundColor: '#fff' },
  iconCircleRed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  title: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    letterSpacing: -1, textAlign: 'center', lineHeight: 38,
  },
  subtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', lineHeight: 22, paddingHorizontal: 8,
  },
  stepsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 20, width: '100%', gap: 14, marginTop: 8,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: '#fff', borderColor: '#fff' },
  stepLabel: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  stepLabelDone: { color: '#fff', fontWeight: '600' },
  eta: { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 },
  retryBtn: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  stripeCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14, marginTop: 4,
  },
  stripeCtaText: { fontSize: 14, fontWeight: '700', color: '#0a0a0a' },
  docsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 20, width: '100%', gap: 10, marginTop: 4,
  },
  docsTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  docLabel: { fontSize: 13, color: '#fff', fontWeight: '500', textTransform: 'capitalize' },
  docReason: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  docStatus: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
});
