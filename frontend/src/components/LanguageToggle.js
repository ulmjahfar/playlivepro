import React from 'react';
import { useTranslation } from 'react-i18next';

function LanguageToggle() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-toggle">
      <button onClick={() => changeLanguage('en')} className={i18n.language === 'en' ? 'active' : ''}>EN</button>
      <button onClick={() => changeLanguage('ml')} className={i18n.language === 'ml' ? 'active' : ''}>ML</button>
    </div>
  );
}

export default LanguageToggle;
