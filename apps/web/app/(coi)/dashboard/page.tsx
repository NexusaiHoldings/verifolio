import { getDashboardData } from '@/lib/coi/dashboard-aggregator';
import type { SortField, SortOrder, VendorComplianceRecord } from '@/lib/coi/dashboard-aggregator';
import type { JSX } from 'react';

const STATUS_CFG = {
  compliant:     { bg: '#dcfce7', text: '#15803d', label: 'Compliant' },
  expiring_soon: { bg: '#fef9c3', text: '#a16207', label: 'Expiring Soon' },
  non_compliant: { bg: '#fee2e2', text: '#b91c1c', label: 'Non-Compliant' },
  missing:       { bg: '#f3f4f6', text: '#374151', label: 'Missing' },
} as const;

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#65a30d', none: '#6b7280',
};

const VALID_SORT_FIELDS: SortField[] = [
  'expiration_date', 'gap_severity', 'vendor_name', 'property_name', 'status',
];

function DisclaimerBanner(): JSX.Element {
  return (
    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
      <strong>Liability Disclaimer:</strong> This compliance dashboard is for informational purposes only
      and does not constitute legal advice. Certificate data reflects the as-of generation date and requires
      independent verification. Consult qualified legal and insurance counsel before acting on any finding.
      Coverage gaps represent potential liability exposure requiring prompt remediation.
    </div>
  );
}

function SummaryCard({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }): JSX.Element {
  return (
    <div style={{ background: bg, border: `1px solid ${color}40`, borderRadius: 8, padding: '16px 24px', minWidth: 120, textAlign: 'center' }}>
      <div style={{ fontSize: 34, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: VendorComplianceRecord['status'] }): JSX.Element {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ background: cfg.bg, color: cfg.text, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function SortLink({ field, current, order, label }: { field: SortField; current: SortField; order: SortOrder; label: string }): JSX.Element {
  const nextOrder: SortOrder = current === field && order === 'desc' ? 'asc' : 'desc';
  const indicator = current === field ? (order === 'desc' ? ' ↓' : ' ↑') : '';
  return (
    <a href={`/dashboard?sort=${field}&order=${nextOrder}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: current === field ? 700 : 400 }}>
      {label}{indicator}
    </a>
  );
}

interface PageProps {
  searchParams: { sort?: string; order?: string };
}

export default async function DashboardPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const rawSort = searchParams.sort as SortField;
  const rawOrder = searchParams.order as SortOrder;
  const sortField: SortField = VALID_SORT_FIELDS.includes(rawSort) ? rawSort : 'gap_severity';
  const sortOrder: SortOrder = rawOrder === 'asc' ? 'asc' : 'desc';

  const { summary, records } = await getDashboardData(sortField, sortOrder);

  const thStyle = { padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, whiteSpace: 'nowrap' as const };
  const tdStyle = { padding: '8px 12px' };

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '32px 40px', maxWidth: 1280, margin: '0 auto', color: '#111' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>COI Compliance Dashboard</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          Certificate of Insurance compliance status across all vendors and properties.
          Click column headers to sort.
        </p>
      </div>

      <DisclaimerBanner />

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <SummaryCard label="Compliant"     count={summary.compliant}    color="#15803d" bg="#dcfce7" />
        <SummaryCard label="Expiring Soon" count={summary.expiringSoon} color="#a16207" bg="#fef9c3" />
        <SummaryCard label="Non-Compliant" count={summary.nonCompliant} color="#b91c1c" bg="#fee2e2" />
        <SummaryCard label="Missing"       count={summary.missing}      color="#374151" bg="#f3f4f6" />
        <SummaryCard label="Total"         count={summary.total}        color="#1d4ed8" bg="#dbeafe" />
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af', fontSize: 14 }}>
          No compliance records found. Vendor certificates will appear here once COI documents are ingested.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}><SortLink field="vendor_name"   current={sortField} order={sortOrder} label="Vendor" /></th>
                <th style={thStyle}><SortLink field="property_name" current={sortField} order={sortOrder} label="Property" /></th>
                <th style={thStyle}>Cert Type</th>
                <th style={thStyle}><SortLink field="status"          current={sortField} order={sortOrder} label="Status" /></th>
                <th style={thStyle}><SortLink field="expiration_date" current={sortField} order={sortOrder} label="Expiration" /></th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Days Left</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Coverage</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Required</th>
                <th style={thStyle}><SortLink field="gap_severity" current={sortField} order={sortOrder} label="Gap Severity" /></th>
                <th style={thStyle}>Report</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, idx) => {
                const daysColor = rec.daysUntilExpiration !== null && rec.daysUntilExpiration < 0
                  ? '#dc2626'
                  : rec.daysUntilExpiration !== null && rec.daysUntilExpiration <= 30
                    ? '#d97706' : '#374151';
                return (
                  <tr key={`${rec.vendorId}-${rec.propertyId}-${rec.certificateType}`}
                    style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{rec.vendorName}</td>
                    <td style={tdStyle}>{rec.propertyName}</td>
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
                    <td style={{ ...tdStyle, fontWeight: 600, color: SEVERITY_COLOR[rec.gapSeverity] ?? '#374151', textTransform: 'capitalize' }}>
                      {rec.gapSeverity}
                    </td>
                    <td style={tdStyle}>
                      <a href={`/reports/${rec.propertyId}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                        View →
                      </a>
                    </td>
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
