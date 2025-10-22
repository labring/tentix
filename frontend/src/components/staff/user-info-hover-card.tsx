import { useTranslation } from "i18n";
import { type UserType } from "tentix-server/rpc";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "tentix-ui";
import { ChevronDown, ChevronRight, Mail, Phone, Calendar, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@lib/utils";

interface UserInfoHoverCardProps {
  user: UserType;
  children: React.ReactNode;
}

interface JsonRendererProps {
  data: unknown;
  depth?: number;
  maxDepth?: number;
  className?: string;
}

function JsonRenderer({ data, depth = 0, maxDepth = 3, className }: JsonRendererProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  const renderValue = (value: unknown, key: string): React.ReactNode => {
    // Handle null values
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }

    // Handle strings
    if (typeof value === 'string') {
      // Check if it's a URL or email
      if (value.match(/^https?:\/\//)) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline truncate block max-w-[200px]"
          >
            {value}
          </a>
        );
      }
      if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return (
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:text-blue-800 underline truncate block max-w-[200px]"
          >
            {value}
          </a>
        );
      }
      return <span className="text-foreground truncate block max-w-[200px]">{value}</span>;
    }

    // Handle numbers
    if (typeof value === 'number') {
      return <span className="text-foreground font-mono">{value}</span>;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return (
        <Badge
          variant={value ? "default" : "secondary"}
          className="text-xs"
        >
          {value ? 'true' : 'false'}
        </Badge>
      );
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (depth >= maxDepth) {
        return (
          <div className="text-muted-foreground text-sm">
            [{value.length} items]
          </div>
        );
      }

      return (
        <Collapsible
          open={isExpanded}
          onOpenChange={setIsExpanded}
          className="w-full"
        >
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            [{value.length} items]
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-4 space-y-1">
            {value.map((item, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground font-mono text-xs">{index}.</span>
                <div className="flex-1">
                  {renderValue(item, `${key}[${index}]`)}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    // Handle objects
    if (typeof value === 'object') {
      if (depth >= maxDepth) {
        return (
          <div className="text-muted-foreground text-sm">
            {Object.keys(value).length} properties
          </div>
        );
      }

      const entries = Object.entries(value);
      return (
        <Collapsible
          open={isExpanded}
          onOpenChange={setIsExpanded}
          className="w-full"
        >
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {'{'}{entries.length} properties{'}'}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-4 space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-muted-foreground font-medium">{k}: </span>
                <span className="text-foreground">{renderValue(v, k)}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return <span className="text-foreground">{String(value)}</span>;
  };

  return (
    <div className={cn("space-y-1", className)}>
      {renderValue(data, 'root')}
    </div>
  );
}

export function UserInfoHoverCard({ user, children }: UserInfoHoverCardProps) {
  const { t } = useTranslation();

  const hasMetaInfo = user.meta && Object.keys(user.meta).length > 0;
  const hasBasicInfo = !!(user.nickname || user.realName);
  const hasContactInfo = !!(user.phoneNum || user.email);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-96 p-0 shadow-lg border bg-card/95 backdrop-blur-sm"
        align="start"
        sideOffset={12}
      >
        <div className="bg-gradient-to-br from-white to-gray-50/30 rounded-xl">
          {/* Header Section */}
          <div className="p-5 border-b border-border/50">
            <div className="flex items-start gap-4">
              <div className="relative">
                <Avatar className="h-14 w-14 ring-2 ring-background ring-offset-2 ring-offset-background">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Level Badge */}
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm ring-2 ring-background">
                  {user.level}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-base leading-tight truncate">
                  {user.name}
                </h3>
                {user.realName && (
                  <p className="text-sm text-muted-foreground font-medium mt-0.5">
                    {user.realName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {t("customer") || "Customer"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Lv.{user.level}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto">
            {/* Basic Information */}
            {hasBasicInfo && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("basic_info") || "Basic Info"}
                </h4>
                <div className="space-y-2">
                  {user.nickname && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground min-w-0 flex-shrink-0">
                        {t("nickname") || "Nickname"}:
                      </span>
                      <span className="font-medium truncate">{user.nickname}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Information */}
            {hasContactInfo && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("contact_info") || "Contact Info"}
                </h4>
                <div className="space-y-2">
                  {user.phoneNum && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground min-w-0 flex-shrink-0">
                        {t("phone") || "Phone"}:
                      </span>
                      <span className="font-medium">{user.phoneNum}</span>
                    </div>
                  )}
                  {user.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground min-w-0 flex-shrink-0">
                        {t("email") || "Email"}:
                      </span>
                      <a
                        href={`mailto:${user.email}`}
                        className="font-medium text-blue-600 hover:text-blue-800 truncate"
                      >
                        {user.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meta Information */}
            {hasMetaInfo && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("additional_info") || "Additional Info"}
                </h4>
                <div className="space-y-3">
                  {Object.entries(user.meta).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="font-medium text-sm text-foreground capitalize flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="ml-4">
                        <JsonRenderer data={value} depth={0} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registration Time */}
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {t("registered_since") || "Registered since"}{" "}
                  {new Date(user.registerTime).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}