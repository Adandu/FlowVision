interface SectionCardProps {
    title?: string;
    icon?: React.ReactNode;
    titleSuffix?: React.ReactNode;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export default function SectionCard({ title, icon, titleSuffix, headerRight, children, className = '' }: SectionCardProps) {
    const showHeader = title || headerRight;

    return (
        <div className={`bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl ${className}`}>
            {showHeader && (
                <div className="flex items-center justify-between mb-4">
                    {title && (
                        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                            {icon}{title}{titleSuffix}
                        </h2>
                    )}
                    {headerRight}
                </div>
            )}
            {children}
        </div>
    );
}
