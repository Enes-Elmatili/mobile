// lib/webrtc/CallService.ts
// ─── WebRTC peer connection manager for VoIP calls ───────────────────────────
// Lazy-loads react-native-webrtc so the app doesn't crash in Expo Go.

import { devLog, devError } from '../logger';

// ─── Lazy WebRTC module ─────────────────────────────────────────────────────
let WebRTC: any = null;

function getWebRTC() {
  if (!WebRTC) {
    try {
      WebRTC = require('react-native-webrtc');
    } catch {
      devLog('📞 [WebRTC] react-native-webrtc not available (Expo Go?)');
    }
  }
  return WebRTC;
}

export function isWebRTCAvailable(): boolean {
  return !!getWebRTC();
}

// ─── STUN/TURN configuration ─────────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallEventHandler = {
  onIceCandidate: (candidate: any) => void;
  onRemoteStream: (stream: any) => void;
  onConnectionStateChange: (state: string) => void;
};

export class CallService {
  private pc: any = null;
  private localStream: any = null;
  private handlers: CallEventHandler;
  private _isMuted = false;
  private _isSpeaker = false;

  constructor(handlers: CallEventHandler) {
    this.handlers = handlers;
  }

  // ── Initialize peer connection + get local audio stream ───────────────────
  async initialize(): Promise<void> {
    const webrtc = getWebRTC();
    if (!webrtc) throw new Error('WebRTC not available — use a dev build');

    const { RTCPeerConnection, mediaDevices } = webrtc;

    try {
      // Audio-only stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach((track: any) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });

      // ICE candidates
      this.pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          this.handlers.onIceCandidate(event.candidate);
        }
      };

      // Remote stream
      this.pc.ontrack = (event: any) => {
        if (event.streams?.[0]) {
          this.handlers.onRemoteStream(event.streams[0]);
        }
      };

      // Connection state monitoring
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState || 'unknown';
        devLog(`📞 [WebRTC] Connection state: ${state}`);
        this.handlers.onConnectionStateChange(state);
      };

      this.pc.oniceconnectionstatechange = () => {
        devLog(`📞 [WebRTC] ICE state: ${this.pc?.iceConnectionState}`);
      };

      devLog('📞 [WebRTC] Initialized');
    } catch (err) {
      devError('📞 [WebRTC] Init failed:', err);
      throw err;
    }
  }

  // ── Create SDP offer (caller side) ────────────────────────────────────────
  async createOffer(): Promise<any> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    } as any);
    await this.pc.setLocalDescription(offer);
    devLog('📞 [WebRTC] Offer created');
    return offer;
  }

  // ── Handle incoming SDP offer (callee side) ───────────────────────────────
  async handleOffer(sdp: any): Promise<any> {
    const webrtc = getWebRTC();
    if (!this.pc || !webrtc) throw new Error('PeerConnection not initialized');
    const { RTCSessionDescription } = webrtc;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    devLog('📞 [WebRTC] Answer created');
    return answer;
  }

  // ── Handle incoming SDP answer (caller side) ──────────────────────────────
  async handleAnswer(sdp: any): Promise<void> {
    const webrtc = getWebRTC();
    if (!this.pc || !webrtc) return;
    const { RTCSessionDescription } = webrtc;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    devLog('📞 [WebRTC] Remote answer set');
  }

  // ── Handle incoming ICE candidate ─────────────────────────────────────────
  async addIceCandidate(candidate: any): Promise<void> {
    const webrtc = getWebRTC();
    if (!this.pc || !webrtc) return;
    const { RTCIceCandidate } = webrtc;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      devError('📞 [WebRTC] Failed to add ICE candidate:', err);
    }
  }

  // ── Audio controls ────────────────────────────────────────────────────────
  toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    this.localStream?.getAudioTracks().forEach((track: any) => {
      track.enabled = !this._isMuted;
    });
    return this._isMuted;
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  get isSpeaker(): boolean {
    return this._isSpeaker;
  }

  toggleSpeaker(): boolean {
    this._isSpeaker = !this._isSpeaker;
    return this._isSpeaker;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  destroy(): void {
    devLog('📞 [WebRTC] Destroying');
    this.localStream?.getTracks().forEach((track: any) => track.stop());
    this.localStream = null;
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}