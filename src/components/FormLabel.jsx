export default function FormLabel({ children, required = false }) {
  return (
    <span className="form-label">
      {children}
      {required ? <span className="form-label__required">*</span> : null}
    </span>
  );
}
