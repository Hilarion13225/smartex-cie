package ci.cie.smartprepaid.mqtt;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Construit une {@link SSLSocketFactory} pour le mTLS MQTT directement à
 * partir de fichiers PEM (CA, certificat client, clé privée client) chargés
 * en mémoire au démarrage -- pas de keystore/truststore fichier à gérer.
 * Certificats de laboratoire générés par infra/mosquitto/generate-lab-certs.sh
 * (voir docs/02_developer-pack-poc.md §12_Securite: mTLS + ACL par device).
 */
final class PemTlsSupport {

    private PemTlsSupport() {
    }

    static SSLSocketFactory buildSocketFactory(String caCertPath, String clientCertPath, String clientKeyPath) {
        try {
            CertificateFactory certFactory = CertificateFactory.getInstance("X.509");

            KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
            trustStore.load(null, null);
            try (InputStream in = Files.newInputStream(Path.of(caCertPath))) {
                trustStore.setCertificateEntry("cie-lab-ca", certFactory.generateCertificate(in));
            }
            TrustManagerFactory trustManagerFactory =
                    TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trustManagerFactory.init(trustStore);

            Certificate clientCert;
            try (InputStream in = Files.newInputStream(Path.of(clientCertPath))) {
                clientCert = certFactory.generateCertificate(in);
            }
            PrivateKey privateKey = readPkcs8PrivateKey(Path.of(clientKeyPath));

            // Mot de passe de keystore en mémoire uniquement (jamais persisté ni loggé):
            // l'API KeyStore l'exige mais rien ne le rend au disque ici.
            char[] inMemoryOnlyPassword = "cie-lab-poc".toCharArray();
            KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
            keyStore.load(null, null);
            keyStore.setKeyEntry("client", privateKey, inMemoryOnlyPassword, new Certificate[]{clientCert});
            KeyManagerFactory keyManagerFactory =
                    KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            keyManagerFactory.init(keyStore, inMemoryOnlyPassword);

            SSLContext sslContext = SSLContext.getInstance("TLSv1.2");
            sslContext.init(keyManagerFactory.getKeyManagers(), trustManagerFactory.getTrustManagers(),
                    new SecureRandom());
            return sslContext.getSocketFactory();
        } catch (IOException | GeneralSecurityException e) {
            throw new IllegalStateException("Impossible de construire le contexte TLS mTLS pour MQTT: "
                    + e.getMessage(), e);
        }
    }

    /** Clé privée attendue au format PEM PKCS#8 non chiffré (`openssl genpkey`, voir generate-lab-certs.sh). */
    private static PrivateKey readPkcs8PrivateKey(Path path) throws IOException, GeneralSecurityException {
        String pem = Files.readString(path);
        String base64 = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePrivate(new PKCS8EncodedKeySpec(der));
    }
}
