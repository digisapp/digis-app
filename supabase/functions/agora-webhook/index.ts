import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Agora webhook event types
interface AgoraEvent {
  eventType: number
  noticeId: string
  notifyMs: number
  payload: {
    channel: string
    uid: string
    clientSeq: number
    ts?: number
    duration?: number
  }
}

// Event type mappings
const AGORA_EVENTS = {
  10: 'USER_JOIN_CHANNEL',
  11: 'USER_LEAVE_CHANNEL',
  20: 'USER_JOIN_STREAM',
  21: 'USER_LEAVE_STREAM',
  30: 'RECORDING_START',
  31: 'RECORDING_STOP',
  40: 'RECORDING_FILE_UPLOADED',
  103: 'USER_BANNED',
  104: 'IP_BANNED'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('Agora-Signature')
    const timestamp = req.headers.get('Agora-Signature-V2-Timestamp')
    
    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const event: AgoraEvent = await req.json()
    console.log('Received Agora event:', AGORA_EVENTS[event.eventType] || 'UNKNOWN', event)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Process event based on type
    switch (event.eventType) {
      case 10: // USER_JOIN_CHANNEL
        await handleUserJoinChannel(supabase, event)
        break
      
      case 11: // USER_LEAVE_CHANNEL
        await handleUserLeaveChannel(supabase, event)
        break
      
      case 30: // RECORDING_START
        await handleRecordingStart(supabase, event)
        break
      
      case 31: // RECORDING_STOP
        await handleRecordingStop(supabase, event)
        break
      
      case 40: // RECORDING_FILE_UPLOADED
        await handleRecordingUploaded(supabase, event)
        break
      
      default:
        console.log('Unhandled event type:', event.eventType)
    }

    return new Response(
      JSON.stringify({ success: true, noticeId: event.noticeId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleUserJoinChannel(supabase: any, event: AgoraEvent) {
  const { channel, uid, ts } = event.payload
  
  // Update session participant count
  const { error } = await supabase
    .from('sessions')
    .update({ 
      participant_count: supabase.sql`participant_count + 1`,
      last_activity_at: new Date(ts || Date.now()).toISOString()
    })
    .eq('agora_channel', channel)
    .eq('status', 'active')

  if (error) {
    console.error('Error updating session for user join:', error)
  }

  // Log participant join
  await supabase
    .from('session_participants')
    .insert({
      session_channel: channel,
      user_uid: uid,
      joined_at: new Date(ts || Date.now()).toISOString(),
      status: 'active'
    })
}

async function handleUserLeaveChannel(supabase: any, event: AgoraEvent) {
  const { channel, uid, ts, duration } = event.payload
  
  // Update session participant count
  const { error } = await supabase
    .from('sessions')
    .update({ 
      participant_count: supabase.sql`GREATEST(participant_count - 1, 0)`,
      last_activity_at: new Date(ts || Date.now()).toISOString()
    })
    .eq('agora_channel', channel)
    .eq('status', 'active')

  if (error) {
    console.error('Error updating session for user leave:', error)
  }

  // Update participant record
  await supabase
    .from('session_participants')
    .update({
      left_at: new Date(ts || Date.now()).toISOString(),
      duration_seconds: duration || 0,
      status: 'left'
    })
    .eq('session_channel', channel)
    .eq('user_uid', uid)
    .eq('status', 'active')

  // If this was a paid session, handle billing
  if (duration && duration > 0) {
    await handleSessionBilling(supabase, channel, uid, duration)
  }
}

async function handleSessionBilling(supabase: any, channel: string, uid: string, durationSeconds: number) {
  // Get session details
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, creator_id, fan_id, rate_per_min, type')
    .eq('agora_channel', channel)
    .eq('status', 'active')
    .single()

  if (sessionError || !session) {
    console.error('Session not found for billing:', channel)
    return
  }

  const durationMinutes = Math.ceil(durationSeconds / 60)
  const totalCost = durationMinutes * session.rate_per_min

  // Update session with billing info
  await supabase
    .from('sessions')
    .update({
      duration_minutes: durationMinutes,
      total_cost: totalCost,
      billed_at: new Date().toISOString()
    })
    .eq('id', session.id)

  // Deduct tokens from member
  const { error: deductError } = await supabase.rpc('deduct_tokens', {
    user_id: session.fan_id,
    amount: totalCost,
    session_id: session.id,
    description: `${session.type} session - ${durationMinutes} minutes`
  })

  if (deductError) {
    console.error('Error deducting tokens:', deductError)
  }

  // Add tokens to creator
  const creatorAmount = totalCost // 100% to creator, no platform fee
  const { error: creditError } = await supabase.rpc('credit_tokens', {
    user_id: session.creator_id,
    amount: creatorAmount,
    session_id: session.id,
    description: `Earnings from ${session.type} session`
  })

  if (creditError) {
    console.error('Error crediting tokens:', creditError)
  }
}

async function handleRecordingStart(supabase: any, event: AgoraEvent) {
  const { channel } = event.payload
  
  // Update session to indicate recording started
  await supabase
    .from('sessions')
    .update({ 
      is_recording: true,
      recording_started_at: new Date().toISOString()
    })
    .eq('agora_channel', channel)
    .eq('status', 'active')
}

async function handleRecordingStop(supabase: any, event: AgoraEvent) {
  const { channel } = event.payload
  
  // Update session to indicate recording stopped
  await supabase
    .from('sessions')
    .update({ 
      is_recording: false,
      recording_stopped_at: new Date().toISOString()
    })
    .eq('agora_channel', channel)
}

async function handleRecordingUploaded(supabase: any, event: AgoraEvent) {
  const { channel } = event.payload
  const recordingUrl = (event.payload as any).fileList?.[0]?.fileName
  
  if (!recordingUrl) {
    console.error('No recording URL in upload event')
    return
  }

  // Store recording info
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('agora_channel', channel)
    .single()

  if (session) {
    await supabase
      .from('session_recordings')
      .insert({
        session_id: session.id,
        recording_url: recordingUrl,
        uploaded_at: new Date().toISOString()
      })
  }
}