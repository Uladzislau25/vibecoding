import type { Metadata } from "next";

export const metadata: Metadata = { title: "Нет сети" };

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>
        <div className="text-5xl mb-4">🍳</div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Нет подключения</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          ChefBot недоступен офлайн. Проверьте интернет и попробуйте снова.
        </p>
      </div>
    </div>
  );
}
