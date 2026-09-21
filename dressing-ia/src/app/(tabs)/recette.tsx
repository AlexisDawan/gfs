/**
 * Recette : les 30 scénarios rejoués sur le dressing courant.
 *
 * L'argument commercial tient dans un chiffre : le critère d'acceptation n'est
 * pas « la tenue est jolie », c'est « le rapport isolation / cible tombe entre
 * 0,85 et 1,15 ». Binaire, mesurable, identique d'une exécution à l'autre.
 */

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { RATIO_MAX, RATIO_MIN } from '@/domain/clo';
import { runRecette, type RecetteReport } from '@/domain/scenarios';
import { useWardrobe } from '@/store/wardrobe-store';
import { AppText, Badge, Button, Card, EmptyState, Meter, Screen } from '@/theme/components';
import { useTokens } from '@/theme/tokens';

/** Seuil d'acceptation commerciale affiché sur la jauge. */
const PASS_RATE_TARGET = 80;

function fr(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

interface RunState {
  report: RecetteReport;
  /** Taille du dressing au moment de l'exécution : sert à signaler un rapport périmé. */
  size: number;
}

export default function RecetteScreen() {
  const t = useTokens();
  const { wardrobe, loading, resetDemo } = useWardrobe();
  const [run, setRun] = useState<RunState | null>(null);
  const [running, setRunning] = useState(false);

  const launch = (): void => {
    setRunning(true);
    setRun(null);
    // Les 30 scénarios bloquent le fil principal ~1 s : on laisse React peindre
    // l'état « en cours » avant de lancer le calcul.
    setTimeout(() => {
      const report = runRecette(wardrobe);
      setRun({ report, size: wardrobe.length });
      setRunning(false);
    }, 16);
  };

  const report = run?.report ?? null;
  const stale = run !== null && run.size !== wardrobe.length;
  const failures = report === null ? [] : report.results.filter((result) => !result.passed);

  return (
    <Screen scroll>
      <View style={{ paddingTop: t.spacing.lg, gap: t.spacing.xs }}>
        <AppText variant="title">Recette</AppText>
        <AppText variant="caption" tone="faint">
          30 situations météo rejouées sur tes {wardrobe.length} pièces
        </AppText>
      </View>

      <Card style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
        <AppText variant="heading">Un critère binaire</AppText>
        <AppText variant="body" tone="muted">
          Une tenue passe si son isolation totale tient entre {fr(RATIO_MIN, 2)} et{' '}
          {fr(RATIO_MAX, 2)} fois la cible du jour. Rien à interpréter : c’est vrai ou c’est faux.
        </AppText>
        <AppText variant="body" tone="muted">
          Aucune horloge, aucun tirage au sort, aucun appel réseau : deux exécutions de suite
          donnent exactement le même rapport, devant toi comme devant ton client.
        </AppText>
      </Card>

      {loading ? (
        <View style={[styles.centered, { paddingVertical: t.spacing.xxl }]}>
          <ActivityIndicator color={t.colors.accent} />
          <AppText tone="muted">Chargement du dressing…</AppText>
        </View>
      ) : wardrobe.length === 0 ? (
        <Card style={{ marginTop: t.spacing.lg }}>
          <EmptyState
            icon="◌"
            title="Rien à tester"
            description="Le dressing est vide : les 30 scénarios échoueraient tous, ce qui ne prouve rien. Recharge la démo d’abord."
            actionLabel="Recharger la démo"
            onAction={resetDemo}
          />
        </Card>
      ) : (
        <View style={{ marginTop: t.spacing.lg, gap: t.spacing.lg }}>
          <Button
            label={running ? 'Exécution en cours…' : report === null ? 'Lancer la recette' : 'Relancer la recette'}
            icon={running ? undefined : '▶'}
            fullWidth
            disabled={running}
            onPress={launch}
          />

          {running ? (
            <View style={styles.centered}>
              <ActivityIndicator color={t.colors.accent} />
              <AppText variant="caption" tone="muted">
                30 scénarios, environ une seconde.
              </AppText>
            </View>
          ) : null}

          {report === null && !running ? (
            <AppText variant="caption" tone="faint">
              La recette n’est pas jouée au chargement : elle se lance sur action, pour que tu
              puisses montrer le calcul se dérouler.
            </AppText>
          ) : null}

          {report !== null ? (
            <>
              <Card style={{ gap: t.spacing.lg }}>
                <View style={styles.scoreRow}>
                  <AppText variant="title" style={styles.scoreBig}>
                    {report.passed}/{report.total}
                  </AppText>
                  <Badge
                    label={`${report.passRate} %`}
                    tone={report.passRate >= PASS_RATE_TARGET ? 'success' : 'warning'}
                  />
                </View>

                <Meter
                  label={`Taux de réussite · objectif ${PASS_RATE_TARGET} %`}
                  valueLabel={`${report.passRate} %`}
                  value={report.passRate}
                  targetMin={PASS_RATE_TARGET}
                  targetMax={100}
                />

                <AppText variant="body" tone="muted">
                  {failures.length === 0
                    ? 'Les 30 scénarios passent avec ce dressing.'
                    : `${failures.length} scénario${failures.length > 1 ? 's échouent' : ' échoue'} : l’isolation disponible sort de la zone de recette. Le rapport nomme la situation au lieu de la masquer — c’est ce qui indique quelle pièce ajouter.`}
                </AppText>

                {stale ? (
                  <AppText variant="caption" tone="danger">
                    Le dressing a changé depuis cette exécution ({run?.size} pièces alors,{' '}
                    {wardrobe.length} maintenant). Relance la recette.
                  </AppText>
                ) : null}
              </Card>

              <View style={{ gap: t.spacing.sm }}>
                <AppText variant="heading">Détail des scénarios</AppText>
                <Card flush>
                  {report.results.map((result, index) => (
                    <View
                      key={result.scenario.id}
                      style={[
                        styles.resultRow,
                        {
                          paddingHorizontal: t.spacing.lg,
                          paddingVertical: t.spacing.md,
                          gap: t.spacing.md,
                          borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderTopColor: t.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.resultText}>
                        <AppText variant="caption" numberOfLines={2}>
                          {result.scenario.label}
                        </AppText>
                        <AppText variant="mono" tone="faint">
                          {result.outfit === null
                            ? 'aucune tenue composable'
                            : `${fr(result.ratio, 2)} × cible`}
                        </AppText>
                      </View>
                      <Badge
                        label={result.passed ? 'OK' : 'Échec'}
                        tone={result.passed ? 'success' : 'danger'}
                      />
                    </View>
                  ))}
                </Card>
              </View>
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scoreBig: { fontSize: 44, lineHeight: 50 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultText: { flex: 1, gap: 2 },
});
