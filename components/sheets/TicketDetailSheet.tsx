import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

interface TicketDetailSheetProps {
  ticket: any | null;
  isVisible: boolean;
  onClose: () => void;
}

export default function TicketDetailSheet({
  ticket,
  isVisible,
  onClose,
}: TicketDetailSheetProps) {
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      PENDING_PAYMENT: { label: 'En attente de paiement', color: '#FF9500', icon: 'card-outline' },
      PUBLISHED: { label: 'Publié', color: '#007AFF', icon: 'megaphone-outline' },
      ACCEPTED: { label: 'Accepté', color: '#34C759', icon: 'checkmark-circle-outline' },
      ONGOING: { label: 'En cours', color: '#007AFF', icon: 'sync-outline' },
      DONE: { label: 'Terminé', color: '#34C759', icon: 'checkmark-done-outline' },
      CANCELLED: { label: 'Annulé', color: '#8E8E93', icon: 'ban-outline' },
    };
    return statusMap[status] || { label: status, color: '#8E8E93', icon: 'help-outline' };
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const openMap = () => {
    if (ticket?.lat && ticket?.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${ticket.lat},${ticket.lng}`;
      Linking.openURL(url);
    }
  };

  if (!isVisible || !ticket) return null;

  const statusInfo = getStatusInfo(ticket.status);

  return (
    <BottomSheet
      index={0}
      snapPoints={['90%']}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.indicator}
    >
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        {/* ==================== HEADER ==================== */}
        <View style={styles.header}>
          <Text style={styles.title}>Demande #{ticket.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon as any} size={18} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* ==================== URGENT BADGE ==================== */}
        {!!ticket.urgent && (
          <View style={styles.urgentContainer}>
            <Ionicons name="alert-circle" size={20} color="#FF3B30" />
            <Text style={styles.urgentText}>Demande urgente</Text>
          </View>
        )}

        {/* ==================== SERVICE ==================== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="construct-outline" size={22} color="#007AFF" />
            <Text style={styles.cardTitle}>Service demandé</Text>
          </View>
          
          <Text style={styles.serviceType}>{ticket.serviceType}</Text>

          {/* Catégorie et sous-catégorie */}
          {(ticket.category || ticket.subcategory) && (
            <View style={styles.categoryRow}>
              {!!ticket.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {ticket.category.name || 'Catégorie'}
                  </Text>
                </View>
              )}
              {/* Correction ici : suppression du Fragment <> potentiellement buggé */}
              {!!ticket.subcategory && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                  <View style={[styles.categoryBadge, { marginLeft: 8 }]}>
                    <Text style={styles.categoryText}>
                      {ticket.subcategory.name}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {!!ticket.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.description}>{ticket.description}</Text>
            </View>
          )}

          {/* Client Info */}
          {!!ticket.clientInfo && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#007AFF" />
              <Text style={styles.infoText}>{ticket.clientInfo}</Text>
            </View>
          )}
        </View>

        {/* ==================== LOCALISATION ==================== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={22} color="#007AFF" />
            <Text style={styles.cardTitle}>Localisation</Text>
          </View>

          <Text style={styles.address}>{ticket.address}</Text>
          
          {/* Coordonnées GPS */}
          {(ticket.lat && ticket.lng) ? (
            <View style={styles.coordsContainer}>
              <Text style={styles.coordsLabel}>Coordonnées GPS</Text>
              <Text style={styles.coordsValue}>
                {Number(ticket.lat).toFixed(6)}, {Number(ticket.lng).toFixed(6)}
              </Text>
            </View>
          ) : null}

          {/* Bouton Carte */}
          {(ticket.lat && ticket.lng) ? (
            <TouchableOpacity style={styles.mapButton} onPress={openMap}>
              <Ionicons name="map-outline" size={18} color="#fff" />
              <Text style={styles.mapButtonText}>Ouvrir dans Maps</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ==================== DATE SOUHAITÉE ==================== */}
        {(ticket.preferredTimeStart || ticket.preferredTimeEnd) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={22} color="#007AFF" />
              <Text style={styles.cardTitle}>Date souhaitée</Text>
            </View>

            {!!ticket.preferredTimeStart && (
              <View style={styles.dateRow}>
                <View style={styles.dateIcon}>
                  <Ionicons name="calendar" size={16} color="#007AFF" />
                </View>
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>Début</Text>
                  <Text style={styles.dateText}>
                    {new Date(ticket.preferredTimeStart).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.dateTime}>
                    {new Date(ticket.preferredTimeStart).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {!!ticket.preferredTimeEnd && (
              <View style={[styles.dateRow, { marginTop: 12 }]}>
                <View style={styles.dateIcon}>
                  <Ionicons name="calendar" size={16} color="#007AFF" />
                </View>
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>Fin</Text>
                  <Text style={styles.dateText}>
                    {new Date(ticket.preferredTimeEnd).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.dateTime}>
                    {new Date(ticket.preferredTimeEnd).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ==================== PRESTATAIRE ==================== */}
        {!!ticket.provider && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={22} color="#007AFF" />
              <Text style={styles.cardTitle}>Prestataire assigné</Text>
            </View>

            <View style={styles.providerCard}>
              <View style={styles.providerAvatar}>
                <Ionicons name="person" size={28} color="#007AFF" />
              </View>
              <View style={styles.providerDetails}>
                <Text style={styles.providerName}>
                  {ticket.provider.name || 'Prestataire'}
                </Text>
                {!!ticket.provider.city && (
                  <View style={styles.providerLocationRow}>
                    <Ionicons name="location" size={14} color="#666" />
                    <Text style={styles.providerCity}>{ticket.provider.city}</Text>
                  </View>
                )}
                {ticket.providerDistanceKm != null && (
                  <View style={styles.distanceRow}>
                    <Ionicons name="navigate" size={14} color="#007AFF" />
                    <Text style={styles.distanceText}>
                      À {Number(ticket.providerDistanceKm).toFixed(1)} km
                    </Text>
                  </View>
                )}
                {!!ticket.provider.avgRating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {Number(ticket.provider.avgRating).toFixed(1)} / 5
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ==================== CONTRAT ==================== */}
        {!!ticket.contractUrl && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={22} color="#007AFF" />
              <Text style={styles.cardTitle}>Contrat</Text>
            </View>

            <TouchableOpacity 
              style={styles.documentButton}
              onPress={() => Linking.openURL(ticket.contractUrl)}
            >
              <Ionicons name="document" size={20} color="#007AFF" />
              <Text style={styles.documentButtonText}>Voir le contrat</Text>
              <Ionicons name="open-outline" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== INFORMATIONS ==================== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            <Text style={styles.cardTitle}>Informations</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Créée le</Text>
            <Text style={styles.infoValue}>
              {new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })} à {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Modifiée le</Text>
              <Text style={styles.infoValue}>
                {new Date(ticket.updatedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })} à {new Date(ticket.updatedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Référence</Text>
            <Text style={styles.infoValue}>#{ticket.id}</Text>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  indicator: {
    backgroundColor: '#E0E0E0',
    width: 40,
    height: 4,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  urgentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B3015',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  urgentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 10,
  },
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
  },
  serviceType: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    marginBottom: 14,
    lineHeight: 28,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryBadge: {
    backgroundColor: '#007AFF20',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  descriptionContainer: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#007AFF10',
    padding: 14,
    borderRadius: 10,
    marginTop: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 10,
    lineHeight: 20,
  },
  address: {
    fontSize: 17,
    color: '#000',
    lineHeight: 24,
    marginBottom: 12,
  },
  coordsContainer: {
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  coordsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  coordsValue: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'monospace',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
  },
  mapButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateContent: {
    flex: 1,
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  dateTime: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerDetails: {
    flex: 1,
    marginLeft: 14,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  providerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerCity: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 4,
    fontWeight: '600',
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF10',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  documentButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    flex: 0.4,
  },
  infoValue: {
    fontSize: 15,
    color: '#000',
    textAlign: 'right',
    flex: 0.6,
  },
});
