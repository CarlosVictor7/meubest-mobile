/**
 * useCallRingtone — Toca ringtone em loop enquanto active=true
 *
 * Usa expo-av Audio.Sound para carregar e tocar o arquivo de ringtone.
 * Para e descarrega o som quando active=false ou ao desmontar.
 * Tratar erros com try/catch para não quebrar o modal de chamada.
 */
import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RINGTONE_ASSET = require('../../../../assets/sounds/ringtone.wav');

export function useCallRingtone(active: boolean) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      // Para e descarrega o som ao desativar
      const stopAndUnload = async () => {
        const sound = soundRef.current;
        if (!sound) return;
        soundRef.current = null;
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (_) {
          // Silencia erros de stop/unload
        }
      };
      stopAndUnload();
      return;
    }

    // Evita múltiplas cargas simultâneas
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const loadAndPlay = async () => {
      try {
        // Configura o modo de áudio para tocar mesmo em modo silencioso (iOS)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          RINGTONE_ASSET,
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );
        soundRef.current = sound;
      } catch (err) {
        // Erro silencioso — não quebra o modal
        if (__DEV__) console.log('[useCallRingtone] erro ao carregar ringtone:', err);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadAndPlay();

    // Cleanup: para o som ao desmontar com active=true
    return () => {
      const sound = soundRef.current;
      if (!sound) return;
      soundRef.current = null;
      sound.stopAsync().catch(() => {});
      sound.unloadAsync().catch(() => {});
    };
  }, [active]);
}
