"use client";

import { useMemo, useState } from "react";

const LISTINGS = [
  { id: "sl-001", name: "Riverside Logistics Park", hasOm: true },
  { id: "sl-002", name: "Midtown Office Tower", hasOm: false },
  { id: "sl-003", name: "Harbor Retail Strip", hasOm: true },
  { id: "sl-004", name: "Northfield Industrial", hasOm: false },
  { id: "sl-005", name: "Summit Medical Plaza", hasOm: true },
];

export default function SalesListings() {
  const [hasOmOnly, setHasOmOnly] = useState(false);

  const rows = useMemo(
    () => (hasOmOnly ? LISTINGS.filter((l) => l.hasOm) : LISTINGS),
    [hasOmOnly]
  );

  return (
    <section className="sales panel" aria-labelledby="sales-listings-heading">
      <h2 id="sales-listings-heading">Sales listings</h2>
      <p className="muted small">
        Operating memorandum (OM) availability per listing.
      </p>

      <div className="sales__toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={hasOmOnly}
            onChange={(e) => setHasOmOnly(e.target.checked)}
          />
          Has OM only
        </label>
        <span className="muted small">
          Showing {rows.length} of {LISTINGS.length}
        </span>
      </div>

      <div className="sales__table-wrap">
        <table className="sales__table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Listing</th>
              <th scope="col">OM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <code>{row.id}</code>
                </td>
                <td>{row.name}</td>
                <td>{row.hasOm ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
