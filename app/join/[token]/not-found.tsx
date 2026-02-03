export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Invitation Not Found
          </h2>
          <p className="text-gray-600">
            This invitation link is invalid or has already been used. Please
            contact the organization administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
