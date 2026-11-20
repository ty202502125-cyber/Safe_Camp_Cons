export const Empty = ({ cols, text }) => (
  <tr>
    <td colSpan={cols} className="empty">
      {text}
    </td>
  </tr>
);

/* ---------- certificate (canvas -> PDF / print) ---------- */
