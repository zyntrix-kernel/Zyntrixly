/**
 * ZYNTRIXLY 3.0 APEX - Voice Stage & Spatial Audio Controller
 * Town Hall audio/video stage management with Web Audio HRTF 3D spatial panning
 * and priority speaker audio ducking.
 */

const StageRoles = {
  HOST: 'host',
  SPEAKER: 'speaker',
  HAND_RAISED: 'hand_raised',
  AUDIENCE: 'audience'
};

class StageController {
  constructor(stageId, hostId) {
    this.stageId = stageId;
    this.hostId = hostId;
    this.participants = new Map(); // userId -> { role, position: { x, y, z }, isMuted, isSpeaking }
    this.audioContext = null;
    this.pannerNodes = new Map(); // userId -> PannerNode
    this.gainNodes = new Map(); // userId -> GainNode
    this.activeSpeakerId = null;

    // Register host
    this.participants.set(hostId, {
      role: StageRoles.HOST,
      position: { x: 0, y: 0, z: -1 },
      isMuted: false,
      isSpeaking: false
    });
  }

  /**
   * Initialize Web Audio context for 3D spatial HRTF audio
   */
  initSpatialAudio() {
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
  }

  /**
   * Add participant to stage as audience
   */
  joinStage(userId) {
    if (!this.participants.has(userId)) {
      this.participants.set(userId, {
        role: StageRoles.AUDIENCE,
        position: { x: 0, y: 0, z: -2 },
        isMuted: true,
        isSpeaking: false
      });
    }
    return this.participants.get(userId);
  }

  /**
   * Audience member raises hand
   */
  raiseHand(userId) {
    const p = this.participants.get(userId);
    if (p && p.role === StageRoles.AUDIENCE) {
      p.role = StageRoles.HAND_RAISED;
      p.handRaisedAt = Date.now();
    }
    return p;
  }

  /**
   * Host / Moderator promotes participant to speaker
   * Assigns spatial stage coordinate (-1.0 to 1.0 along X axis)
   */
  promoteToSpeaker(userId, stagePositionX = 0) {
    const p = this.participants.get(userId);
    if (p) {
      p.role = StageRoles.SPEAKER;
      p.isMuted = false;
      p.position = { x: stagePositionX, y: 0, z: -1.5 };
      delete p.handRaisedAt;

      // Update 3D HRTF panner node if audio context is active
      if (this.audioContext && this.pannerNodes.has(userId)) {
        const panner = this.pannerNodes.get(userId);
        if (panner.positionX) {
          panner.positionX.setValueAtTime(stagePositionX, this.audioContext.currentTime);
        } else {
          panner.setPosition(stagePositionX, 0, -1.5);
        }
      }
    }
    return p;
  }

  /**
   * Lower participant to audience
   */
  demoteToAudience(userId) {
    const p = this.participants.get(userId);
    if (p && p.role !== StageRoles.HOST) {
      p.role = StageRoles.AUDIENCE;
      p.isMuted = true;
      p.isSpeaking = false;
      p.position = { x: 0, y: 0, z: -2 };
    }
    return p;
  }

  /**
   * Priority speaker audio ducking: when host or keynote speaks,
   * ducks other participants by -12dB (gain reduced to 0.25)
   */
  setSpeakingState(userId, isSpeaking) {
    const p = this.participants.get(userId);
    if (!p) return;

    p.isSpeaking = isSpeaking;

    if (isSpeaking && p.role === StageRoles.HOST) {
      this.activeSpeakerId = userId;
      // Duck all other speakers by -12dB
      if (this.audioContext) {
        this.gainNodes.forEach((gainNode, otherUserId) => {
          if (otherUserId !== userId) {
            gainNode.gain.setTargetAtTime(0.25, this.audioContext.currentTime, 0.05); // -12dB
          }
        });
      }
    } else if (!isSpeaking && this.activeSpeakerId === userId) {
      this.activeSpeakerId = null;
      // Restore normal gain
      if (this.audioContext) {
        this.gainNodes.forEach((gainNode) => {
          gainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.1);
        });
      }
    }
  }

  /**
   * Connect a participant's WebRTC audio stream to the 3D HRTF spatial panner & gain nodes
   */
  attachAudioStream(userId, mediaStream) {
    if (!this.audioContext || !mediaStream) return;
    try {
      const source = this.audioContext.createMediaStreamSource(mediaStream);
      const panner = this.audioContext.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';

      const gain = this.audioContext.createGain();
      gain.gain.value = 1.0;

      const p = this.participants.get(userId);
      const posX = p && p.position ? p.position.x : 0;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(posX, this.audioContext.currentTime);
        panner.positionY.setValueAtTime(0, this.audioContext.currentTime);
        panner.positionZ.setValueAtTime(-1.5, this.audioContext.currentTime);
      } else if (panner.setPosition) {
        panner.setPosition(posX, 0, -1.5);
      }

      source.connect(panner);
      panner.connect(gain);
      gain.connect(this.audioContext.destination);

      this.pannerNodes.set(userId, panner);
      this.gainNodes.set(userId, gain);
    } catch (err) {
      console.warn('Could not attach spatial audio stream:', err);
    }
  }

  destroy() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (_) {}
    }
    this.pannerNodes.clear();
    this.gainNodes.clear();
    this.participants.clear();
  }

  getStageState() {
    const speakers = [];
    const handRaised = [];
    const audience = [];

    this.participants.forEach((data, userId) => {
      const entry = { userId, ...data };
      if (data.role === StageRoles.HOST || data.role === StageRoles.SPEAKER) {
        speakers.push(entry);
      } else if (data.role === StageRoles.HAND_RAISED) {
        handRaised.push(entry);
      } else {
        audience.push(entry);
      }
    });

    return {
      stageId: this.stageId,
      hostId: this.hostId,
      speakers,
      handRaised,
      audienceCount: audience.length
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StageController, StageRoles };
}
if (typeof window !== 'undefined') {
  window.StageController = StageController;
  window.StageRoles = StageRoles;
}
