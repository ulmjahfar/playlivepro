import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
// (tip: move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: {
      "Welcome": "Welcome",
      "Dashboard": "Dashboard",
      "Settings": "Settings",
      "Logout": "Logout",
      "Change Password": "Change Password",
      "Update Profile": "Update Profile",
      "Color Theme": "Color Theme",
      "Language": "Language",
      "DB Mode": "DB Mode",
      "Local": "Local",
      "Cloud": "Cloud",
      "MongoDB URL": "MongoDB URL",
      "Save": "Save",
      // Login page translations
      "Super Admin Login": "Super Admin Login",
      "Sign in to manage your tournaments.": "Sign in to manage your tournaments.",
      "Email or Username": "Email or Username",
      "Enter your email or username": "Enter your email or username",
      "Password": "Password",
      "Enter your password": "Enter your password",
      "Enter your username": "Enter your username",
      "Tournament Admin Login": "Tournament Admin Login",
      "Welcome Back": "Welcome Back",
      "Access your tournament admin dashboard": "Access your tournament admin dashboard",
      "Need help?": "Need help?",
      "Contact Super Admin or support@playlive.com": "Contact Super Admin or support@playlive.com",
      "Remember Me": "Remember Me",
      "Forgot Password?": "Forgot Password?",
      "Login": "Login",
      "Logging in...": "Logging in...",
      "Login successful! Redirecting...": "Login successful! Redirecting...",
      "Incorrect username or password.": "Incorrect username or password.",
      "Need help logging in?": "Need help logging in?",
      "Contact Support:": "Contact Support:",
      "Message on WhatsApp": "Message on WhatsApp",
      "All rights reserved.": "All rights reserved.",
      "Powered by PlayLive — Tournament Made Simple": "Powered by PlayLive — Tournament Made Simple",
      "Hide password": "Hide password",
      "Show password": "Show password",
      // Tournament Admin Login translations
      "Sign in to manage your tournament": "Sign in to manage your tournament",
      "Username or Email": "Username or Email",
      "Enter your username or email": "Enter your username or email",
      "Keep me signed in": "Keep me signed in",
      // Add more as needed
    }
  },
  ml: {
    translation: {
      "Welcome": "സ്വാഗതം",
      "Dashboard": "ഡാഷ്ബോർഡ്",
      "Settings": "ക്രമീകരണങ്ങൾ",
      "Logout": "ലോഗൗട്ട്",
      "Change Password": "പാസ്‌വേഡ് മാറ്റുക",
      "Update Profile": "പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്യുക",
      "Color Theme": "കളർ തീം",
      "Language": "ഭാഷ",
      "DB Mode": "ഡിബി മോഡ്",
      "Local": "ലോക്കൽ",
      "Cloud": "ക്ലൗഡ്",
      "MongoDB URL": "മോംഗോഡിബി URL",
      "Save": "സേവ്",
      // Login page translations
      "Super Admin Login": "സൂപ്പർ അഡ്മിൻ ലോഗിൻ",
      "Sign in to manage your tournaments.": "നിങ്ങളുടെ ടൂർണമെന്റുകൾ നിയന്ത്രിക്കാൻ ലോഗിൻ ചെയ്യുക",
      "Email or Username": "ഇമെയിൽ അല്ലെങ്കിൽ യൂസർനെയിം",
      "Enter your email or username": "നിങ്ങളുടെ ഇമെയിൽ അല്ലെങ്കിൽ യൂസർനെയിം നൽകുക",
      "Password": "പാസ്‌വേഡ്",
      "Enter your password": "നിങ്ങളുടെ പാസ്‌വേഡ് നൽകുക",
      "Enter your username": "നിങ്ങളുടെ യൂസർനെയിം നൽകുക",
      "Tournament Admin Login": "ടൂർണമെന്റ് അഡ്മിൻ ലോഗിൻ",
      "Welcome Back": "വീണ്ടും സ്വാഗതം",
      "Access your tournament admin dashboard": "നിങ്ങളുടെ ടൂർണമെന്റ് അഡ്മിൻ ഡാഷ്ബോർഡ് ആക്സസ് ചെയ്യുക",
      "Need help?": "സഹായം വേണോ?",
      "Contact Super Admin or support@playlive.com": "സൂപ്പർ അഡ്മിൻ അല്ലെങ്കിൽ support@playlive.com എന്നതുമായി ബന്ധപ്പെടുക",
      "Remember Me": "എന്നെ ഓർക്കുക",
      "Forgot Password?": "പാസ്‌വേഡ് മറന്നോ?",
      "Login": "ലോഗിൻ ചെയ്യുക",
      "Logging in...": "ലോഗിൻ ചെയ്യുന്നു...",
      "Login successful! Redirecting...": "ലോഗിൻ വിജയകരം! റീഡയറക്ട് ചെയ്യുന്നു...",
      "Incorrect username or password.": "തെറ്റായ യൂസർനെയിം അല്ലെങ്കിൽ പാസ്‌വേഡ്",
      "Need help logging in?": "ലോഗിൻ ചെയ്യാൻ സഹായം വേണോ?",
      "Contact Support:": "പിന്തുണയുമായി ബന്ധപ്പെടുക:",
      "Message on WhatsApp": "വാട്ട്‌സ്ആപ്പിൽ സന്ദേശം അയയ്ക്കുക",
      "All rights reserved.": "എല്ലാ അവകാശങ്ങളും സംരക്ഷിച്ചിരിക്കുന്നു",
      "Powered by PlayLive — Tournament Made Simple": "പ്ലെയ്ലൈവ് വഴി — ടൂർണമെന്റുകൾ എളുപ്പത്തിൽ നടത്താം",
      "Hide password": "പാസ്‌വേഡ് മറയ്ക്കുക",
      "Show password": "പാസ്‌വേഡ് കാണിക്കുക",
      // Tournament Admin Login translations
      "Sign in to manage your tournament": "നിങ്ങളുടെ ടൂർണമെന്റ് നിയന്ത്രിക്കാൻ ലോഗിൻ ചെയ്യുക",
      "Username or Email": "യൂസർനെയിം അല്ലെങ്കിൽ ഇമെയിൽ",
      "Enter your username or email": "നിങ്ങളുടെ യൂസർനെയിം അല്ലെങ്കിൽ ഇമെയിൽ നൽകുക",
      "Keep me signed in": "എന്നെ ഓർക്കുക",
      // Add more as needed
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // language to use, more info here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option

    interpolation: {
      escapeValue: false // react already does escaping
    }
  });

export default i18n;
