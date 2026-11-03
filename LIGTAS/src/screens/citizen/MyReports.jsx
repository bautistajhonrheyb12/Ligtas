import { useState } from 'preact/hooks'
import { getReportPhotoUrl } from '../../lib/supabase.js'
import { Icon, LoadingCards, reportTypeStyle, timeAgo } from '../../lib/ui.jsx'

const statusKey = { Pending: 'statusPending', Verified: 'statusVerified', Resolved: 'statusResolved', Rejected: 'statusRejected', Cancelled: 'statusCancelled' }

function reportSteps(report, t) {
  if (report.status === 'Rejected' || report.status === 'Cancelled') {
    return [{ label: t('stepSent'), done: true }, { label: t(statusKey[report.status]), done: true, ended: report.status === 'Rejected' ? 'is-rejected' : 'is-withdrawn' }]
  }
  const verified = report.status === 'Verified' || report.status === 'Resolved'
  const responding = Boolean(report.assigned_to) || report.status === 'Resolved'
  const respondingLabel = report.response_stage === 'On scene'
    ? t('stepOnScene')
    : report.response_stage === 'En route' ? t('stepEnRoute') : t('stepResponding')
  return [
    { label: t('stepSent'), done: true },
    { label: t('stepVerified'), done: verified },
    { label: respondingLabel, done: responding },
    { label: t('stepResolved'), done: report.status === 'Resolved' },
  ]
}


function ReportPhoto({ path, t }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  if (url) return <a href={url} target="_blank" rel="noreferrer"><img class="my-report-photo" src={url} alt="" /></a>
  return <button type="button" class="my-report-photo-button" disabled={failed} onClick={() => getReportPhotoUrl(path).then(setUrl).catch(() => setFailed(true))}>
    <Icon name="camera" size={16} /> {t('viewPhoto')}
  </button>
}

// Two taps so a report is never withdrawn by accident.
function WithdrawButton({ t, onWithdraw }) {
  const [state, setState] = useState('idle')
  const press = async () => {
    if (state === 'idle') {
      setState('confirm')
      setTimeout(() => setState((current) => current === 'confirm' ? 'idle' : current), 4000)
      return
    }
    setState('busy')
    await onWithdraw()
    setState('idle')
  }
  return <button type="button" class={`my-report-withdraw${state === 'confirm' ? ' is-confirming' : ''}`} onClick={press} disabled={state === 'busy'}>
    {state === 'busy' ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="x" size={14} />}
    {state === 'confirm' ? t('withdrawConfirm') : t('withdraw')}
  </button>
}

export function MyReports({ t, reports, queued, loading, error, onWithdraw }) {
  return <div class="citizen-panel">
    <div class="alerts-header-row"><h2>{t('myReportsTitle')}</h2><span class="severity-button">{reports.length + queued.length}</span></div>
    {error && <p class="admin-notice" role="alert">{error}</p>}
    {loading && <LoadingCards label={t('loadingReports')} count={2} />}
    <div class="my-report-list">
      {queued.map((report) => {
        const style = reportTypeStyle(report.reportType)
        return <article class={`my-report rx-tone--${style.tone} is-queued`} key={report.queuedAt}>
          <div class="my-report-top">
            <span class="my-report-icon"><Icon name={style.icon} size={18} /></span>
            <div><strong>{t('types')[report.reportType] ?? report.reportType}</strong><small>{report.location}</small></div>
            <span class="my-report-status my-report-status--queued"><Icon name="wifiOff" size={13} /> {t('statusQueued')}</span>
          </div>
        </article>
      })}
      {!loading && reports.map((report) => {
        const style = reportTypeStyle(report.report_type)
        return <article class={`my-report rx-tone--${style.tone}`} key={report.id}>
          <div class="my-report-top">
            <span class="my-report-icon"><Icon name={style.icon} size={18} /></span>
            <div><strong>{t('types')[report.report_type] ?? report.report_type}</strong><small>{report.location} · {timeAgo(report.created_at)}</small></div>
            <span class={`my-report-status my-report-status--${report.status.toLowerCase()}`}>{t(statusKey[report.status])}</span>
          </div>
          <ol class="report-steps">
            {reportSteps(report, t).map((step) => <li key={step.label} class={`${step.done ? 'is-done' : ''}${step.ended ? ` ${step.ended}` : ''}`}><i />{step.label}</li>)}
          </ol>
          {report.resolution_note && <p class="my-report-note"><b>{report.status === 'Rejected' ? t('rejectReason') : t('responderNote')}:</b> {report.resolution_note}</p>}
          {(report.photo_path || report.status === 'Pending') && <div class="my-report-actions">
            {report.photo_path && <ReportPhoto path={report.photo_path} t={t} />}
            {report.status === 'Pending' && <WithdrawButton t={t} onWithdraw={() => onWithdraw(report)} />}
          </div>}
        </article>
      })}
      {!loading && !error && reports.length === 0 && queued.length === 0 && <p class="admin-empty-state">{t('noReports')}</p>}
    </div>
  </div>
}
