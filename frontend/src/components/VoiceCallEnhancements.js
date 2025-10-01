import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MicrophoneIcon,
  MusicalNoteIcon,
  AdjustmentsHorizontalIcon,
  CloudArrowUpIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  SignalIcon,
  MixerVerticalIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const VoiceCallEnhancements = ({ 
  audioTrack, 
  agoraClient,
  isHost = false,
  onSettingsChange 
}) => {
  // Audio Profile Settings
  const [audioProfile, setAudioProfile] = useState({
    profile: 'music_high_quality_stereo', // 48kHz stereo
    scenario: 'game_streaming'
  });

  // Voice Effects
  const [voiceEffects, setVoiceEffects] = useState({
    beautifier: 'off',
    effect: 'off',
    pitch: 0,
    equalizer: {
      band31: 0,
      band62: 0,
      band125: 0,
      band250: 0,
      band500: 0,
      band1k: 0,
      band2k: 0,
      band4k: 0,
      band8k: 0,
      band16k: 0
    },
    reverb: {
      level: 0,
      delay: 0,
      roomSize: 0,
      wetLevel: 0,
      strength: 0
    }
  });

  // Audio Mixing
  const [audioMixing, setAudioMixing] = useState({
    enabled: false,
    url: '',
    volume: 50,
    playbackSpeed: 1.0,
    loop: false
  });

  // Recording Settings
  const [recording, setRecording] = useState({
    enabled: false,
    cloud: true,
    format: 'aac',
    bitrate: 128000,
    sampleRate: 48000,
    channels: 2
  });

  // Multi-track Support
  const [additionalTracks, setAdditionalTracks] = useState([]);
  const [trackMixing, setTrackMixing] = useState({
    mainVolume: 100,
    trackVolumes: {}
  });

  // Network Optimization
  const [networkOptimization, setNetworkOptimization] = useState({
    adaptiveBitrate: true,
    packetLossConcealment: true,
    jitterBuffer: 'adaptive',
    redundantCoding: true
  });

  const audioMixerRef = useRef(null);
  const recordingRef = useRef(null);

  // Audio profiles for different scenarios
  const audioProfiles = {
    'music_high_quality_stereo': {
      name: 'Music HQ (48kHz Stereo)',
      profile: 'music_high_quality_stereo',
      scenario: 'game_streaming',
      bitrate: 128,
      sampleRate: 48000,
      channels: 2
    },
    'speech_standard': {
      name: 'Speech Standard',
      profile: 'speech_standard',
      scenario: 'chatroom',
      bitrate: 32,
      sampleRate: 16000,
      channels: 1
    },
    'singing_high_quality': {
      name: 'Singing HQ',
      profile: 'singing_high_quality',
      scenario: 'education',
      bitrate: 96,
      sampleRate: 48000,
      channels: 2
    },
    'high_quality': {
      name: 'High Quality',
      profile: 'high_quality',
      scenario: 'meeting',
      bitrate: 64,
      sampleRate: 32000,
      channels: 1
    }
  };

  // Voice beautifiers
  const voiceBeautifiers = {
    off: 'Natural',
    chat_beautifier_magnetic: 'Magnetic',
    chat_beautifier_fresh: 'Fresh',
    chat_beautifier_vitality: 'Vitality',
    singing_beautifier: 'Singing',
    timbre_transformation_vigorous: 'Vigorous',
    timbre_transformation_deep: 'Deep',
    timbre_transformation_mellow: 'Mellow',
    timbre_transformation_falsetto: 'Falsetto',
    timbre_transformation_full: 'Full',
    timbre_transformation_clear: 'Clear',
    timbre_transformation_resounding: 'Resounding',
    timbre_transformation_ringing: 'Ringing'
  };

  // Voice effects presets
  const voiceEffectPresets = {
    off: 'No Effect',
    voice_changer_effect_uncle: 'Uncle',
    voice_changer_effect_oldman: 'Old Man',
    voice_changer_effect_boy: 'Boy',
    voice_changer_effect_sister: 'Sister',
    voice_changer_effect_girl: 'Girl',
    voice_changer_effect_pigking: 'Pig King',
    voice_changer_effect_hulk: 'Hulk',
    style_transformation_rnb: 'R&B',
    style_transformation_popular: 'Popular',
    room_acoustics_ktv: 'KTV',
    room_acoustics_vocal_concert: 'Vocal Concert',
    room_acoustics_studio: 'Studio',
    room_acoustics_phonograph: 'Phonograph',
    room_acoustics_spacial: 'Spacial',
    room_acoustics_ethereal: 'Ethereal',
    room_acoustics_3d_voice: '3D Voice',
    pitch_correction: 'Pitch Correction'
  };

  useEffect(() => {
    if (audioTrack) {
      applyAudioProfile();
    }
  }, [audioTrack, audioProfile]);

  useEffect(() => {
    if (audioTrack) {
      applyVoiceEffects();
    }
  }, [audioTrack, voiceEffects]);

  const applyAudioProfile = async () => {
    if (!audioTrack || !agoraClient) return;

    try {
      const profile = audioProfiles[audioProfile.profile];
      
      // Set audio profile and scenario
      await agoraClient.setAudioProfile(profile.profile);
      await agoraClient.setAudioScenario(profile.scenario);
      
      // Set encoding configuration
      await audioTrack.setEncoderConfiguration({
        bitrate: profile.bitrate,
        sampleRate: profile.sampleRate,
        stereo: profile.channels === 2
      });

      // toast.success(`Audio profile set to ${profile.name}`);
      
      if (onSettingsChange) {
        onSettingsChange({ audioProfile: profile });
      }
    } catch (error) {
      console.error('Failed to apply audio profile:', error);
      toast.error('Failed to apply audio profile');
    }
  };

  const applyVoiceEffects = async () => {
    if (!audioTrack) return;

    try {
      // Apply voice beautifier
      if (voiceEffects.beautifier !== 'off') {
        await audioTrack.setVoiceBeautifierPreset(voiceEffects.beautifier);
      }

      // Apply voice effect
      if (voiceEffects.effect !== 'off') {
        await audioTrack.setAudioEffectPreset(voiceEffects.effect);
      }

      // Apply pitch shift
      if (voiceEffects.pitch !== 0) {
        await audioTrack.setLocalVoicePitch(voiceEffects.pitch);
      }

      // Apply equalizer
      const eqBands = Object.entries(voiceEffects.equalizer);
      for (const [band, gain] of eqBands) {
        const bandIndex = {
          band31: 0, band62: 1, band125: 2, band250: 3, band500: 4,
          band1k: 5, band2k: 6, band4k: 7, band8k: 8, band16k: 9
        }[band];
        await audioTrack.setLocalVoiceEqualization(bandIndex, gain);
      }

      // Apply reverb
      if (voiceEffects.reverb.level > 0) {
        await audioTrack.setLocalVoiceReverb({
          level: voiceEffects.reverb.level,
          delay: voiceEffects.reverb.delay,
          roomSize: voiceEffects.reverb.roomSize,
          wetLevel: voiceEffects.reverb.wetLevel,
          strength: voiceEffects.reverb.strength
        });
      }
    } catch (error) {
      console.error('Failed to apply voice effects:', error);
      toast.error('Failed to apply voice effects');
    }
  };

  const startAudioMixing = async () => {
    if (!audioTrack || !audioMixing.url) return;

    try {
      await agoraClient.startAudioMixing(audioMixing.url, {
        loopback: false,
        replace: false,
        cycle: audioMixing.loop ? -1 : 1,
        startPos: 0,
        playTime: 0,
        publish: true
      });

      await agoraClient.adjustAudioMixingVolume(audioMixing.volume);
      await agoraClient.setAudioMixingPlaybackSpeed(audioMixing.playbackSpeed);
      
      setAudioMixing(prev => ({ ...prev, enabled: true }));
      // toast.success('Audio mixing started');
    } catch (error) {
      console.error('Failed to start audio mixing:', error);
      toast.error('Failed to start audio mixing');
    }
  };

  const stopAudioMixing = async () => {
    try {
      await agoraClient.stopAudioMixing();
      setAudioMixing(prev => ({ ...prev, enabled: false }));
      // toast.success('Audio mixing stopped');
    } catch (error) {
      console.error('Failed to stop audio mixing:', error);
    }
  };

  const startCloudRecording = async () => {
    if (!agoraClient || recording.enabled) return;

    try {
      // Initialize cloud recording
      const response = await fetch('/api/agora/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: agoraClient.channelName,
          uid: agoraClient.uid,
          token: agoraClient.token,
          recordingConfig: {
            channelType: 0,
            streamTypes: 0, // Audio only
            audioProfile: recording.format === 'aac' ? 0 : 1,
            audioSampleRate: recording.sampleRate,
            bitrate: recording.bitrate,
            channelCount: recording.channels,
            format: recording.format
          }
        })
      });

      const data = await response.json();
      recordingRef.current = data.recordingId;
      
      setRecording(prev => ({ ...prev, enabled: true }));
      // toast.success('Cloud recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopCloudRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await fetch('/api/agora/recording/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: recordingRef.current
        })
      });

      setRecording(prev => ({ ...prev, enabled: false }));
      // toast.success('Recording saved to cloud');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const createAdditionalAudioTrack = async (source = 'microphone') => {
    try {
      const track = await window.AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: audioProfiles[audioProfile.profile],
        AEC: true,
        ANS: true,
        AGC: true
      });

      setAdditionalTracks(prev => [...prev, {
        id: Date.now(),
        track,
        source,
        volume: 100,
        enabled: true
      }]);

      // toast.success('Additional audio track created');
    } catch (error) {
      console.error('Failed to create audio track:', error);
      toast.error('Failed to create audio track');
    }
  };

  const removeAudioTrack = async (trackId) => {
    const track = additionalTracks.find(t => t.id === trackId);
    if (track) {
      await track.track.close();
      setAdditionalTracks(prev => prev.filter(t => t.id !== trackId));
    }
  };

  const adjustTrackVolume = (trackId, volume) => {
    const track = additionalTracks.find(t => t.id === trackId);
    if (track) {
      track.track.setVolume(volume);
      setTrackMixing(prev => ({
        ...prev,
        trackVolumes: { ...prev.trackVolumes, [trackId]: volume }
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Audio Profile Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MicrophoneIcon className="w-5 h-5 text-purple-600" />
          Audio Profile (48kHz Support)
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(audioProfiles).map(([key, profile]) => (
            <button
              key={key}
              onClick={() => setAudioProfile({ profile: key, scenario: profile.scenario })}
              className={`p-3 rounded-lg border-2 transition-all ${
                audioProfile.profile === key
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-400'
              }`}
            >
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  {profile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {profile.sampleRate}Hz • {profile.bitrate}kbps
                </p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Voice Effects */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MusicalNoteIcon className="w-5 h-5 text-purple-600" />
          Voice Effects & Beautifiers
        </h3>

        <div className="space-y-4">
          {/* Voice Beautifier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voice Beautifier
            </label>
            <select
              value={voiceEffects.beautifier}
              onChange={(e) => setVoiceEffects(prev => ({ ...prev, beautifier: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              {Object.entries(voiceBeautifiers).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* Voice Effect */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voice Effect
            </label>
            <select
              value={voiceEffects.effect}
              onChange={(e) => setVoiceEffects(prev => ({ ...prev, effect: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              {Object.entries(voiceEffectPresets).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* Pitch Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pitch Shift: {voiceEffects.pitch}
            </label>
            <input
              type="range"
              min="-12"
              max="12"
              value={voiceEffects.pitch}
              onChange={(e) => setVoiceEffects(prev => ({ ...prev, pitch: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Audio Mixing */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MixerVerticalIcon className="w-5 h-5 text-purple-600" />
          Audio Mixing
        </h3>

        <div className="space-y-3">
          <input
            type="url"
            placeholder="Audio file URL..."
            value={audioMixing.url}
            onChange={(e) => setAudioMixing(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
          />
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Volume: {audioMixing.volume}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={audioMixing.volume}
                onChange={(e) => setAudioMixing(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
            
            <div className="flex-1">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Speed: {audioMixing.playbackSpeed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={audioMixing.playbackSpeed}
                onChange={(e) => setAudioMixing(prev => ({ ...prev, playbackSpeed: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={audioMixing.loop}
                onChange={(e) => setAudioMixing(prev => ({ ...prev, loop: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Loop</span>
            </label>
            
            <Button
              size="sm"
              onClick={audioMixing.enabled ? stopAudioMixing : startAudioMixing}
              disabled={!audioMixing.url}
            >
              {audioMixing.enabled ? 'Stop Mixing' : 'Start Mixing'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Cloud Recording */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CloudArrowUpIcon className="w-5 h-5 text-purple-600" />
          Cloud Recording
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Format
              </label>
              <select
                value={recording.format}
                onChange={(e) => setRecording(prev => ({ ...prev, format: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
              >
                <option value="aac">AAC</option>
                <option value="mp3">MP3</option>
                <option value="opus">Opus</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sample Rate
              </label>
              <select
                value={recording.sampleRate}
                onChange={(e) => setRecording(prev => ({ ...prev, sampleRate: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg"
              >
                <option value="48000">48 kHz</option>
                <option value="44100">44.1 kHz</option>
                <option value="32000">32 kHz</option>
                <option value="16000">16 kHz</option>
              </select>
            </div>
          </div>

          <Button
            onClick={recording.enabled ? stopCloudRecording : startCloudRecording}
            variant={recording.enabled ? 'secondary' : 'primary'}
            className="w-full"
          >
            {recording.enabled ? 'Stop Recording' : 'Start Cloud Recording'}
          </Button>
        </div>
      </Card>

      {/* Multiple Audio Tracks */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <SpeakerWaveIcon className="w-5 h-5 text-purple-600" />
          Multiple Audio Tracks
        </h3>

        <div className="space-y-3">
          {additionalTracks.map((track) => (
            <div key={track.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium">{track.source}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={track.volume}
                onChange={(e) => adjustTrackVolume(track.id, parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-500">{track.volume}%</span>
              <button
                onClick={() => removeAudioTrack(track.id)}
                className="text-red-600 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          ))}
          
          <Button
            size="sm"
            variant="secondary"
            onClick={() => createAdditionalAudioTrack()}
            className="w-full"
          >
            Add Audio Track
          </Button>
        </div>
      </Card>

      {/* Network Optimization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <SignalIcon className="w-5 h-5 text-purple-600" />
          Network Optimization
        </h3>

        <div className="space-y-3">
          {Object.entries({
            adaptiveBitrate: 'Adaptive Bitrate',
            packetLossConcealment: 'Packet Loss Concealment',
            redundantCoding: 'Redundant Coding'
          }).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={networkOptimization[key]}
                onChange={(e) => setNetworkOptimization(prev => ({
                  ...prev,
                  [key]: e.target.checked
                }))}
                className="rounded"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default VoiceCallEnhancements;