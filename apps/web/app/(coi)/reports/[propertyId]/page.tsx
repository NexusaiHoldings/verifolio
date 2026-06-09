import { getPropertyReport, generateCsvReport, REQUIRED_DISCLAIMERS } from '@/lib/coi/report-generator';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import type { VendorComplianceRecord } from '@/lib/coi/dashboard-aggregator';

const STATUS_CFG = {
  compliant:     { bg: '#dcfce7', text: '#15803d', label: 'Compliant' },
  expiring_soon: { bg: '#fef9c3', text: '#a16207', label: 'Expiring Soon' },
  non_compliant: { bg: '#fee2e2', text: '#b91c1c', label: 'Non-Compliant' },
  missing:       { bg: '#f3f4f6', text: '#374151', label: 'Missing' },
} as const;

function DisclaimerBanner(): JSX.Element {
  return (
    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '14px 18px', marginBottom: 28 }}>
      <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 10px', color: '#78350f' }}>
        Required Liability Disclaimers
      </p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {REQUIRED_DISCLAIMERS.map((disclaimer, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={idx} style={{ fontSize: 12, color: '#78350f', marginBottom: 5, lineHeight: 1.5 }}>
            {disclaimer}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: VendorComplianceRecord['status'] }): JSX.Element {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ background: cfg.bg, color: cfg.text, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

interface PageProps {
  params: { propertyId: string };
}

export default async function PropertyReportPage({ params }: PageProps): Promise<JSX.Element> {
  const report = await getPropertyReport(params.propertyId);
  if (!report) notFound();

  const csvContent = generateCsvReport(report);
  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  const safePropertyName = report.propertyName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const dateStamp = report.generatedAt.toISOString().split('T')[0];
  const csvFilename = `coi-report-${safePropertyName}-${dateStamp}.csv`;

  const stats = [
    { label: 'Compliant',     count: report.summary.compliant,    color: '#15803d', bg: '#dcfce7' },
    { label: 'Expiring Soon', count: report.summary.expiringSoon, color: '#a16207', bg: '#fef9c3' },
    { label: 'Non-Compliant', count: report.summary.nonCompliant, color: '#b91c1c', bg: '#fee2e2' },
    { label: 'Missing',       count: report.summary.missing,      color: '#374151', bg: '#f3f4f6' },
  ] as const;

  const thStyle = { padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, whiteSpace: 'nowrap' as const, fontSize: 12 };
  const tdStyle = { padding: '8px 12px', fontSize: 13 };

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '32px 40px', maxWidth: 1200, margin: '0 auto', color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 24, flexWrap: 'wrap' }}>
        <div>
          <a href="/dashboard" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>
            ← Back to Dashboard
          </a>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Compliance Report</h1>
          <p style={{ color: '#374151', fontSize: 15, margin: '0 0 4px', fontWeight: 500 }}>
            {report.propertyName}
            {report.propertyAddress ? <span style={{ fontWeight: 400, color: '#6b7280' }}> · {report.propertyAddress}</span> : null}
          </p>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>Generated: {report.generatedAt.toISOString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <a
            href={csvDataUri}
            download={csvFilename}
            style={{ background: '#1d4ed8', color: '#fff', padding: '9px 18px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Export CSV
          </a>
          <a
            href="javascript:window.print()"
            style={{ background: '#374151', color: '#fff', padding: '9px 18px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Print / PDF
          </a>
        </div>
      </div>

      <DisclaimerBanner />

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        {stats.map(({ label, count, color, bg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${color}40`, borderRadius: 8, padding: '14px 22px', minWidth: 110, textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          </div>
        ))}
        <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: '14px 22px', minWidth: 110, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#1d4ed8', lineHeight: 1 }}>{report.summary.total}</div>
          <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
        </div>
      </div>

      {report.records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af', fontSize: 14 }}>
          No compliance records found for this property.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Vendor</th>
                <th style={thStyle}>Cert Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Expiration</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Days Left</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Coverage</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Required</th>
                <th style={thStyle}>Gap</th>
                <th style={thStyle}>Policy #</th>
                <th style={thStyle}>Insurer</th>
              </tr>
            </thead>
            <tbody>
              {report.records.map((rec, idx) => {
                const daysColor = rec.daysUntilExpiration !== null && rec.daysUntilExpiration < 0
                  ? '#dc2626'
                  : rec.daysUntilExpiration !== null && rec.daysUntilExpiration <= 30
                    ? '#d97706' : '#374151';
                return (
                  <tr key={`${rec.vendorId}-${rec.certificateType}`}
                    style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{rec.vendorName}</td>
                    <td style={tdStyle}>{rec.certificateType}</td>
                    <td style={tdStyle}><StatusBadge status={rec.status} /></td>
                    <td style={tdStyle}>{rec.expirationDate ? rec.expirationDate.toISOString().split('T')[0] : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daysColor }}>
                      {rec.daysUntilExpiration !== null ? rec.daysUntilExpiration : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {rec.coverageAmount !== null ? `$${rec.coverageAmount.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {rec.requiredCoverageAmount !== null ? `$${rec.requiredCoverageAmount.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, textTransform: 'capitalize', color: rec.gapSeverity === 'critical' ? '#dc2626' : rec.gapSeverity === 'high' ? '#ea580c' : rec.gapSeverity === 'medium' ? '#d97706' : '#6b7280' }}>
                      {rec.gapSeverity}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                      {rec.policyNumber ?? '—'}
                    </td>
                    <td style={tdStyle}>{rec.insurer ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
